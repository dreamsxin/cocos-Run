import { PVP_MULT_BALLTE_MAX, SCENE_NAME } from "../../../../app/AppConst";
import { PVE_MODE, PVP_MODE } from "../../../../app/AppEnums";
import { CustomPveFinishResult, PvpConfig } from "../../../../app/AppType";
import { BATTLE_STATE } from "../../../../app/BattleConst";
import { configUtils } from "../../../../app/ConfigUtils";
import engineHook from "../../../../app/EngineHook";
import { audioManager, BGM_TYPE } from "../../../../common/AudioManager";
import { configManager } from "../../../../common/ConfigManager";
import { eventCenter } from "../../../../common/event/EventCenter";
import { battleEvent, battleStatisticEvent, cloudDreamEvent, dailyLessonEvent, deifyCombatEvent, dreamlandEvent, immortalsEvent, lvMapViewEvent, magicDoorEvent, netEvent, nineHellEvent, peakDuelEvent, respectEvent, timeLimitEvent, useInfoEvent, yyBookEvent } from "../../../../common/event/EventData";
import guiManager from "../../../../common/GUIManager";
import { localStorageMgr, SAVE_TAG } from "../../../../common/LocalStorageManager";
import { logger } from "../../../../common/log/Logger";
import { cfg } from "../../../../config/config";
import { data, gamesvr } from "../../../../network/lib/protocol";
import { operationSvr } from "../../../../network/OperationSvr";
import { battleUIData } from "../../../models/BattleUIData";
import { limitData } from "../../../models/LimitData";
import { pveData } from "../../../models/PveData";
import { pveTrialData } from "../../../models/PveTrialData";
import { pvpData } from "../../../models/PvpData";
import { userData } from "../../../models/UserData";
import { battleUIOpt } from "../../../operations/BattleUIOpt";
import { limitDataOpt } from "../../../operations/LimitDataOpt";
import { pveDataOpt } from "../../../operations/PveDataOpt";
import { Role } from "../../../template/Role";
import MessageBoxView, { MsgboxInfo } from "../../view-other/MessageBoxView";
import { ADJUST_TEAM_TYPE } from "../../view-pvp/pvp-peakduel/PVPPeakDuelChangeTeamView";
import UIBTStateBase from "./UIBTStateBase";

const { ccclass, property } = cc._decorator;
const WIN_AINIM_TIME = 1.8;
@ccclass
export default class UIBTStateBattleEnd extends UIBTStateBase {
    stateName: BATTLE_STATE = BATTLE_STATE.BATTLE_END;
    private _endNotify: gamesvr.IBattleEndResult = null;
    private _hasUploaded = false;
    whenEnter (notify: gamesvr.IBattleEndResult, seq: number) {
        this._endNotify = notify;

        eventCenter.register(lvMapViewEvent.FINISH_PVE_RES, this, this._receievePveFinishRes);
        eventCenter.register(dreamlandEvent.FINISH_PVE_RES, this, this._receievePveFinishRes);
        eventCenter.register(dailyLessonEvent.FINISH_PVE_RISEROAD_RES, this, this._receievePveFinishRes);
        eventCenter.register(dailyLessonEvent.FINISH_PVE_DAILY_RES, this, this._receievePveFinishRes);
        // ????????????
        eventCenter.register(cloudDreamEvent.FINISH_PVE_RES, this, this._receievePveFinishRes);
        eventCenter.register(nineHellEvent.FINISH_PVE_RES, this, this._receievePveFinishRes);
        eventCenter.register(magicDoorEvent.FINISH_PVE_RES, this, this._receievePveFinishRes);
        eventCenter.register(yyBookEvent.FINISH_RES, this, this._receievePveFinishRes);
        // pvp??????
        eventCenter.register(deifyCombatEvent.FINISH_PVP_RES, this, this._receievePvpSpiritFinishRes);
        eventCenter.register(immortalsEvent.FINISH_PVP_RES, this, this._receievePvpFairyFinishRes);


        eventCenter.register(timeLimitEvent.END_RANDOM_FIGHT_BATTLE, this, this._receieveRandomFightEndRes);
        eventCenter.register(netEvent.NET_RECONNECTED, this, this._uploadScore);
        eventCenter.register(netEvent.NET_CLOSED, this, this._netFail);

        eventCenter.register(battleEvent.FINISH_PVE_RES_FAIL, this, this._receievePveFinishResFail);

        this._hasUploaded = false;
        this._game.nodeWatingFinish.active = false;

        if (operationSvr.disconnected) {
            operationSvr.reconnect();
        } else {
            this._sendFinishNotify(notify);
        }
        
        engineHook.frameInterval = engineHook.DEFAULT_INTERVAL;
        battleUIOpt.finishCurrMsg(seq);
    }

    leave() {
        this._endNotify = null;
        eventCenter.unregisterAll(this);
    }

    private _sendFinishNotify(notify: gamesvr.IBattleEndResult) {
         if (!notify || !this._endNotify) return;
        
        audioManager.playMusic(BGM_TYPE.NORMAL);
        let pvp = !!pvpData.pvpConfig;
        let selfTeam = battleUIData.getSelfTeam()
        if (selfTeam == null) {
            logger.log("UIBTStateBattleEnd, self team is null, may be is restart")
            return;
        }

        let heros = selfTeam.roles.map(_r => { return _r.roleId });
        let pass = this._endNotify.Win;
       
        if (pvp) {
            if (!pvpData.pvpConfig) {
                logger.error("[UIBTStateBattleEnd] cant find pvp config");
                return;
            };

            //??????????????????????????????????????????-
            if (pvpData.pvpConfig.replay && pvpData.pvpConfig?.step < 0) {
                this._showReplayRes(notify);
                return;
            }

            if (pvpData.pvpConfig.pvpMode == PVP_MODE.IMMORTALS_RANK) {
                this._receievePvpFairyFinishRes(null, pvpData.fairyFinishData);
            } else if (pvpData.pvpConfig.pvpMode == PVP_MODE.DEIFY_COMBAT) {
                this._receievePvpSpiritFinishRes(null, pvpData.spiritFinishData);
            } else if (pvpData.pvpConfig.pvpMode == PVP_MODE.PEAK_DUEL) {
                this._receievePvpPeakDuelFinishRes(null, pvpData.pvpPeakDuekFinishData);
            }
        } else {
            let currLesson = pveData.pveConfig ? pveData.pveConfig.lessonId : pveData.getCurrLessonId();
            let pveConfig = pveData.pveConfig;
            if (!pveConfig) {
                logger.error("[UIBTStateBattleEnd] cant find pve config")
                return;
            };
            if (pveConfig && pveConfig.pveMode == PVE_MODE.CLOUD_DREAM){
                pveDataOpt.reqFinishPveCloud(currLesson, pass || false, heros);
            } else if (pveConfig && pveConfig.pveMode == PVE_MODE.NINE_HELL){
                pveDataOpt.reqFinishPveHell(currLesson, pass, heros);
            } else if (pveConfig && pveConfig.pveMode == PVE_MODE.MAGIC_DOOR) {
                pveDataOpt.reqFinishPveMiracal(currLesson, pass || false);
            } else if (pveConfig && pveConfig.pveMode == PVE_MODE.RANDOM_FIGHT) {
                if(limitData.enterRandomFightData) {
                    limitDataOpt.sendLimitFightEnd(limitData.enterRandomFightData.ID, pass || false);
                }
            } else if (pveConfig && pveConfig.pveMode == PVE_MODE.RESPECT) {
                // ????????????-??????????????????????????????
                this._receievePveFinishRes(null, pveTrialData.challengeFinishData);
            } else if (pveConfig && pveConfig.pveMode == PVE_MODE.FAIRY_ISLAND) {
                this._receievePveFinishRes(null, pveTrialData.IslandFinishData);
            } else if (pveConfig && pveConfig.pveMode == PVE_MODE.XIN_MO_FA_XIANG) {
                // ????????????
                let prizes = pveTrialData.trialDevilData.prizes;
                let roundDamage = pveTrialData.trialDevilData.roundDamage || 0;
                pveTrialData.clearTrialDevilCache();
                //??????????????????LessonID?????????????????????
                this._receievePveFinishRes(null, {LessonID: 1, Past: true, Prizes: prizes, Damage: roundDamage});
			} else if (pveConfig && pveConfig.pveMode == PVE_MODE.PURGATORY) {
                // ???????????? - ??????????????????????????????
                this._receievePveFinishRes(null, pveTrialData.purgatoryFiniData);
            } else if (pveConfig && pveConfig.pveMode == PVE_MODE.YYBOOK) {
                // ????????????
                if (this._checkSubBattleInPveCfg()) {
                    this._enterNextSubBattle(pass);
                } else {
                    pveDataOpt.reqTrialLightDarkFinish(pass);
                }
            } else {
                if (this._checkSubBattle(pveConfig.lessonId, pveConfig.passStep)) {
                    this._enterNextSubBattle(pass);
                } else {
                    pveDataOpt.reqFinishPve(currLesson, pass, heros);
                }
            }
        }
    }

    private _receievePveFinishRes(cmd: any, msg: gamesvr.FinishPveRes|gamesvr.TrialHellFinishPveRes|gamesvr.TrialMiracleDoorFinishPveRes| CustomPveFinishResult) {
        if (msg.LessonID) {
            let viewStr = msg && msg.Past ? "GameWinView" : "GameLoseView";
            this._hasUploaded = true;

            let delay = 0;
            if (msg && msg.Past) {
                delay = WIN_AINIM_TIME
                this._game.heroCtrl.roleItems.forEach( _r => {
                    if(!cc.isValid(_r) || _r.role.hp <= 0) return;
                    _r.playCelebrateAnim();
                })
            }

            this.scheduleOnce(()=> {
                guiManager.loadModuleView(viewStr, msg, ()=> {
                    guiManager.loadScene(SCENE_NAME.MAIN);
                }).then(() => {
                  eventCenter.fire(battleStatisticEvent.OPEN_STATISTIC_VIEW);
                    eventCenter.fire(battleEvent.CLOSE_BATTLE_POP);
                    if (pveData.pveConfig && pveData.pveConfig.userLv && pveData.pveConfig.userLv < userData.lv) {
                        guiManager.showLevelUpView(pveData.pveConfig.userLv).then(() => {
                            eventCenter.fire(useInfoEvent.GAME_EXP_ADD, msg.TotalExp);
                        });
                    } else {
                        eventCenter.fire(useInfoEvent.GAME_EXP_ADD, msg.TotalExp);
                    }
                });
            }, delay)
        }
        eventCenter.fire(battleEvent.CLOSE_BATTLE_POP);
    }
    private _receievePveFinishResFail(cmd: any, desc: string) {
        guiManager.showTips(`?????????${desc}`)
        this._game.nodeWatingFinish.active = false;
    }

    private _receievePvpSpiritFinishRes(cmd: any, msg: gamesvr.PvpSpiritEnterRes) {
        if (msg) {
            let viewStr = "GamePvpWinView";
            this._hasUploaded = true;
            this._game.showSubViewInGame(viewStr, msg)
                .then(() => {
                    this._game.nodeWatingFinish.active = false;
                });
        }
    }

    private _receievePvpFairyFinishRes(cmd: any, msg: gamesvr.PvpFairyEnterRes) {
        if (msg) {
            let viewStr = "GamePvpFairyWinView";
            this._hasUploaded = true;
            this._game.showSubViewInGame(viewStr, msg)
                .then(() => {
                    this._game.nodeWatingFinish.active = false;
                });
        }
    }

    private _receieveRandomFightEndRes(cmd: any, msg: gamesvr.TimeLimitFantasyFinishPveRes) {
        if (!msg) {
            guiManager.loadScene(SCENE_NAME.MAIN);
            return;
        }
        if(msg.ID) {
            let viewStr = msg && msg.Past ? "GameWinView" : "GameLoseView";
            this._hasUploaded = true;
            let delay = 0
            if (msg && msg.Past) {
                delay = WIN_AINIM_TIME
                this._game.heroCtrl.roleItems.forEach( _r => {
                    if (_r && cc.isValid(_r) && _r.role.hp > 0) {
                        _r.playCelebrateAnim();
                    }
                })
            }

            this.scheduleOnce(()=> {
                guiManager.loadModuleView(viewStr, msg, ()=> {
                    guiManager.loadScene(SCENE_NAME.MAIN);
                }).then(() => {
                    this._game.nodeWatingFinish.active = false;
                });
            }, delay)
        }
    }

    private _showReplayRes (res: gamesvr.IBattleEndResult) {
        let isWin = res && res.Win
        let viewStr = isWin ? "GameWinView" : "GameLoseView";

        let delay = 0;
        if (isWin) {
            delay = WIN_AINIM_TIME
            this._game.heroCtrl.roleItems.forEach( _r => {
                if (_r && cc.isValid(_r) && _r.role.hp > 0) {
                    _r.playCelebrateAnim();
                }
            })
        }

        this.scheduleOnce(()=> {
            guiManager.loadModuleView(viewStr, null, ()=> {
                guiManager.loadScene(SCENE_NAME.MAIN);
            }).then(() => {
                this._game.nodeWatingFinish.active = false;
            });
        }, delay)
        
    }

    // ???????????????
    private _enterNextSubBattle (isWin: boolean) {

        let winCallBack = ()=> {
            let heroes = battleUIData.getSelfTeam().roles.map(_r => {return _r.roleId})
            if (pveData.pveConfig.pveMode == PVE_MODE.YYBOOK) {
                pveDataOpt.updateYYBookPveData(heroes);
            } else {
                pveDataOpt.updateAdverturePveData(heroes);
            }
            this._game.onRestart();
        }


        let delay = 0;
        let viewStr = isWin ? "GameWinView" : "GameLoseView";
        if (isWin) {
            delay = WIN_AINIM_TIME
            this._game.heroCtrl.roleItems.forEach( _r => {
                if (_r && cc.isValid(_r) && _r.role.hp > 0) {
                    _r.playCelebrateAnim();
                }
            })
        }

        this.scheduleOnce(()=> {
            guiManager.loadModuleView(viewStr, null, ()=> {
                if (isWin) winCallBack();
            }).then(() => {
                this._game.nodeWatingFinish.active = false;
            });
        }, delay)

        // let info: MsgboxInfo = {
        //     content: "????????????, \n??????????????????",
        //     leftStr: "????????????",
        //     leftCallback: (msgBox: MessageBoxView) => {
        //         msgBox.closeView();
        //         this._game.onRestart();
        //     },
        //     rightStr: null,
        //     rightCallback: null
        // }
        // guiManager.showMessageBox(this._game.node, info)

    }

    whenLeave() {
        this.unscheduleAllCallbacks();
        eventCenter.unregisterAll(this);
    }

    whenProcess() {
    }

    onClickFinishMask() {
        let info: MsgboxInfo = {
            content: "????????????????????????????????????????????????????????????",
            leftStr: "??????",
            leftCallback: (msgbox: MessageBoxView) => {
                msgbox.closeView();
                this._uploadScore();
            },
            rightStr: "??????",
            rightCallback: (msgbox: MessageBoxView) => {
                msgbox.closeView();
                this._game.onClickLeaveGame();
            }
        }
        guiManager.showMessageBox(this._game.node, info);
        return;
    }

    private _uploadScore() {
        if (!this._hasUploaded) {
            if (operationSvr.disconnected) {
                operationSvr.reconnect();
            } else {
                this._sendFinishNotify(this._endNotify);
            }
        }
    }

    private _netFail () {
        guiManager.showMessageBox(this._game.node, {
            content: "??????????????????????????????",
            leftStr: "??? ???",
            leftCallback: (msgBox: MessageBoxView) => {
                msgBox.closeView();
                operationSvr.reconnect()
            },
            rightStr: "??? ???",
            rightCallback: (msgBox: MessageBoxView) => {
                msgBox.closeView();
            },
        })
    }

    private _checkSubBattle (lessonID: number, passSteps: number[]) {
        let cfg: cfg.AdventureLesson = configManager.getConfigByKey("lesson", lessonID);
        if (passSteps && cfg && cfg.LessonMonsterGroupId) {
            let chapterStr = cfg.LessonMonsterGroupId.split(";");
            if (passSteps.length + 1 < chapterStr.length) {
                return true
            }
        }
        return false;
    }


	private _checkSubBattleInPveCfg(): boolean {
        let passSetps: number[] = pveData.pveConfig.passStep;
        let monsterGroupIDs: number[] = pveData.pveConfig.monsterGroupIDs;
        // ????????????????????????step?????????????????????+1
        return passSetps.length + 1 < monsterGroupIDs.length;
    }
    private _receievePvpPeakDuelFinishRes(cmd: any, msg: gamesvr.PvpPeakDuelEnterRes) {
        if (msg) {
            let res = msg.EnterBattleResultList;
            let isWin = res[pvpData.pvpConfig.step]?.BattleEndRes?.Win;
            let delay = 0;
        if (isWin) {
                delay = WIN_AINIM_TIME
                this._game.heroCtrl.roleItems.forEach( _r => {
                    if (_r && cc.isValid(_r) && _r.role.hp > 0) {
                        _r.playCelebrateAnim();
                    }
                })
            } 
            this.scheduleOnce(() => {
                let currStep = pvpData.pvpConfig?.step || 0;
                let curIndex = pvpData.pvpConfig?.idx || 0;
                let nextStep = currStep + 1;
                if (res && res.length && nextStep < PVP_MULT_BALLTE_MAX) {
                    //?????????????????????????????????????????????????????????
                    if (pvpData.pvpConfig && pvpData.pvpConfig?.replay) {
                        pvpData.pvpConfig.replay = msg.EnterBattleResultList[nextStep];
                        pvpData.pvpConfig.step = nextStep;
                    } else {
                        let pvpConfig: PvpConfig = {
                            pvpMode: PVP_MODE.PEAK_DUEL,
                            step: nextStep,
                            idx: curIndex,
                         }
                        pvpData.pvpConfig = pvpConfig;    
                    }
                    
                    this._game.onRestart(true);

                } else {
                    let heroMap: Map<number, number[]> = null;
                    //????????????????????????????????????????????????????????????????????????????????????
                    if (pvpData.pvpConfig?.replay) {
                        heroMap = new Map();
                        let result = msg.EnterBattleResultList;
                        result.forEach((fight, idx) => {
                            let heros: number[] = [0, 0, 0, 0, 0];
                            fight.Teams[0].Roles.forEach(role => {
                                let pos = role.Pos || 0;
                                heros[pos] = role.ID;
                            })
                            heroMap.set(idx, heros);
                        });
                    }

                    let viewStr = "PVPPeakDuelChangeTeamView";
                    this._game.showSubViewInGame(viewStr, heroMap, ADJUST_TEAM_TYPE.COMBAT_SETTLEMENT)
                        .then(() => {
                            this._game.nodeWatingFinish.active = false;
                        });    
                    
                }
            },delay);
        }
    }


}