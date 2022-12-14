import { logger } from "../../../common/log/Logger";
import guiManager from "../../../common/GUIManager";
import LoginScene from "../view-scene/LoginScene";
import UpgradeComponent from "../../../upgrade/UpgradeComponent";
import { gamesvr } from "../../../network/lib/protocol";
import { operationSvr } from "../../../network/OperationSvr";
import { eventCenter } from "../../../common/event/EventCenter";
import { antiAddictionEvent, loginEvent, netEvent } from "../../../common/event/EventData";
import LoginView from "./LoginView";
import { loginData } from "../../models/LoginData";
import MessageBoxView from "../view-other/MessageBoxView";
import PackageUtils, { isAndroid } from "../../../app/PackageUtils";
import { SCENE_NAME } from "../../../app/AppConst";
import { userData } from "../../models/UserData";
import { antiAddictionOpt } from "../../operations/AntiAddictionOpt";
import { AntiAdditionCode } from "../../../app/AppEnums";
import HttpRequest from "../../../network/HttpRequest";
import { appCfg } from "../../../app/AppConfig";
import AntiAddictionView from "../view-antiaddition/AntiAddictionView";
import { utils } from "../../../app/AppUtils";
import { ConfigManager } from "../../../common/ConfigManager";

class BaseState {
    protected _stateCtrl: StateControl = null;
    protected _loginScene: LoginScene = null;
    protected _timer: number = 0;
    constructor() {
    }

    setStateCtrl(stateCtrl: StateControl, loginScene: LoginScene) {
        this._stateCtrl = stateCtrl;
        this._loginScene = loginScene;
    }

    gotoNextState() {
        if (this._stateCtrl.gotoNextState) {
            this._stateCtrl.gotoNextState();
        }
    }

    gotoState(state: STATE_ENUM) {
        if (this._stateCtrl.gotoState) {
            this._stateCtrl.gotoState(state);
        }
    }

    initialize() {
        this.init();
    }

    unInitialize() {
        this.deInit();
    }

    init() { }
    deInit() { }

    protected _checkAntiAdditionCondition (succ: Function, fail: Function) {
        let antiAdditionCode = antiAddictionOpt.antiAdditionEnterCode();
        switch (antiAdditionCode) {
            // ????????????????????????????????????
            case AntiAdditionCode.NON_ADULT_NORMAL: {
                guiManager.loadView("AntiAddictionView", guiManager.sceneNode, antiAdditionCode, ()=> {
                    succ(antiAdditionCode);
                })
                break;
            }
            // ???????????????????????????????????????
            case AntiAdditionCode.NON_ADULT_TIME_FORBIDDEN: {
                guiManager.loadView("AntiAddictionView", guiManager.sceneNode, antiAdditionCode, ()=> {
                    fail(antiAdditionCode);
                })
                break;
            }
            // ????????????
            case AntiAdditionCode.ADULT: 
            default: {
                succ(antiAdditionCode);
            }
        }
    }
}

class CheckUpgrade extends BaseState {
    init() {
        if (cc.sys.isNative) {
            const nodeRet = guiManager.loadView('UpgradeView', this._loginScene.node);
            nodeRet.then((view: UpgradeComponent) => {
                view.startUpgrade(() => {
                    view.closeView()
                    this.gotoNextState();
                });
            }).catch(() => {
                logger.error(`load upgrade view failed.`);
                this.gotoNextState();
            });
        } else {
            this.gotoNextState();
        }
    }

    deInit() {
    }
}

class ConfigUpgrade extends BaseState {
    init(): void {
        //?????????????????????????????????
        this.gotoNextState();
        return;
        if (cc.sys.isNative) {
            const nodeRet = guiManager.loadView('UpgradeView', this._loginScene.node);
            nodeRet.then((view:UpgradeComponent) => {
                view.startConfigUpgrade(() => {
                    view.closeView();
                    ConfigManager.getInstance().init();
                    this.gotoNextState();
                });
            }).catch(() => {
                logger.error(`load ConfigUpgrade view failed.`);
                this.gotoNextState();
            });
        } else {
            this.gotoNextState()
        }
    }

    deInit(): void {

    }
}

class LoginSDK extends BaseState {
    init() {
        // @todo ????????????Android??????sdk
        if (isAndroid()) {
            eventCenter.register(loginEvent.SDK_INIT_COMPLETE, this, this.onSdkInit);
            eventCenter.register(loginEvent.SDK_LOGIN_SUCC, this, this.onLoginSucc);
            eventCenter.register(loginEvent.SDK_LOGIN_FAIL, this, this.onLoginFail);
            eventCenter.register(loginEvent.SDK_AUTH, this, this.onSdkAuth);
            
            let sdkInitStatus = PackageUtils.getSdkInitStatus();
            // ???????????????sdk?????????
            if (sdkInitStatus == 1/**?????? */) {
                this.onSdkInit(null, true);
            } else if (sdkInitStatus == 2/**?????? */) {
                this.onSdkInit(null, false);
            } else {
                this._loginScene.showTips("???????????????????????????");
            }
            
        } else {
            let account = utils.getUserAccount();
            operationSvr.setAccountInfo({
                account: account,
                session: "",
                platform: appCfg.debug.platform
            })
            this.gotoNextState();
        }
    }

    deInit() {
        eventCenter.unregisterAll(this);
    }

    onSdkInit(cmd: number, succ: boolean) {
        eventCenter.unregister(loginEvent.SDK_INIT_COMPLETE, this);
        
        // this._timer = setTimeout(() => {
        //     this._showErrEndGame()
        // }, 10000);

        if (succ) {
            this._loginScene.showTips("????????????????????????");
            PackageUtils.login();
        } else {
            if (this._timer) {
                clearTimeout(this._timer)
            }
            guiManager.showMessageBox(
                guiManager.sceneNode,
                {
                    content: "????????????????????????????????????????????????????????????",
                    leftStr: "??????",
                    leftCallback:  (box: MessageBoxView) => {
                        box.closeView();
                        cc.game.end();
                    },
                    rightStr: null,
                    rightCallback: null,
                }
            );
        }
    }

    onLoginSucc(cmd: number, account: string, session: string, platform: string) {
        if (this._timer) {
            clearTimeout(this._timer)
        }
        this._loginScene.showTips("????????????.");

        PackageUtils.getIsAntiAddiction();
        operationSvr.setAccountInfo({
            account: account,
            session: session,
            platform: platform
        })
        userData.auditAccount = account
    }

    onLoginFail() {
        if (this._timer) {
            clearTimeout(this._timer)
        }
       this._showErrEndGame()
    }

    private _showErrEndGame () {
        guiManager.showMessageBox(
            guiManager.sceneNode,
            {
                content: "?????????????????????????????????????????????????????????",
                leftStr:  "??????",
                leftCallback: (box: MessageBoxView) => {
                    box.closeView();
                    PackageUtils.logout();
                },
                rightStr: null,
                rightCallback: null
            }
        );
    }

    onSdkAuth (cmd: number, succ: boolean) {
        // SKD????????????????????????????????????
        if (succ) {
            guiManager.clearMessageBox(guiManager.sceneNode)
            userData.updateAge();
            let antiAdditionCode = antiAddictionOpt.antiAdditionEnterCode();
            switch (antiAdditionCode) {
                // ???????????????????????????????????????
                case AntiAdditionCode.NON_ADULT_TIME_FORBIDDEN: {
                    guiManager.loadView("AntiAddictionView", guiManager.sceneNode, antiAdditionCode, ()=> {
                        PackageUtils.logout();     
                        cc.game.end()
                    })
                    break;
                }
                default: {
                    this.gotoNextState();
                }
            }

        } else {
            guiManager.showMessageBox(
                guiManager.sceneNode,
                {
                    content: "?????????????????????",
                    leftStr: "??? ???",
                    leftCallback:  (box: MessageBoxView) => {
                        box.closeView();
                        cc.game.end();
                    },
                    rightStr: null,
                    rightCallback: null,
                }
            );
        }

    }
}

class CheckNotice extends BaseState {
    init() {
        logger.log("Check CheckNotice init!");
        let httpRequest = new HttpRequest();
        httpRequest.request(appCfg.remoteCfgUrl, {}, 5000, false).then((res) => {
            try {
                loginData.updateNotice(JSON.parse(res));
            } catch (error) {
                logger.error('parse notice error: ', error);
            }
            this.gotoNextState();
        }).catch(err => {
            logger.error('revNoticeData', err);
            this.gotoNextState();
        });
    }

    deInit() {
    }
}

class LoginWorld extends BaseState {
    init() {
        logger.log("LoginWorld init!");
        this._loginScene.showTips("????????????????????????????????????");

        eventCenter.register(netEvent.NET_CHECK_ACC_RES, this, this._recvFetchRes);
        this.loginWorld();
    }

    deInit() {
        this._loginScene.clearTips();
        eventCenter.unregisterAll(this);
    }

    loginWorld() {
        operationSvr.checkAccount();
    }

    private _recvFetchRes(cmd: number, succ: boolean, errdesc: string) {
        if (!succ) {
            guiManager.showMessageBox(
                guiManager.sceneNode,
                {
                    content: "????????????????????????????????????????????????????????????????????????" + errdesc,
                    leftStr: "??? ???",
                    leftCallback: (box: MessageBoxView) => {
                        box.closeView();
                        PackageUtils.logout();
                        // this.gotoState(STATE_ENUM.CHECK_UPGRADE);
                    }
                }
            );
        } else {
            this.gotoNextState();
        }
    }
}

class LoginServer extends BaseState {
    loginView: LoginView = null;
    isLogining: boolean = false;

    init() {
        logger.log("LoginServer init!");
        this.deInit();
        eventCenter.register(netEvent.NET_LOGIN_SUCC, this, this.netLoginSucc);
        eventCenter.register(netEvent.NET_LOGIN_FAIL, this, this.netLoginFail);

        this.isLogining = false;

        let promise = guiManager.loadView('LoginView', this._loginScene.node);
        promise.then((view: LoginView) => {
            this.loginView = view
            view.init(this.login.bind(this));
        });
    }

    deInit() {
        if (this.loginView != null) {
            this.loginView.onRelease();
            this.loginView.closeView();
            this.loginView = null
        }
        let leftComp = guiManager.sceneNode.getChildByName("AntiAddictionView")
        if (leftComp && cc.isValid(leftComp)) {
            let comp = leftComp.getComponent(AntiAddictionView)
            comp && comp.closeView()
        }
        eventCenter.unregisterAll(this);
    }

    login(url: string) {
        if (this.isLogining) {
            guiManager.showTips("??????????????????");
            return;
        }

        this.isLogining = true;
        operationSvr.login(url);
    }

    netLoginSucc(eid: number, loginRes: gamesvr.LoginRes) {
        // ?????????????????????????????????????????????, ????????????????????????
        this._checkAntiAdditionCondition((code: AntiAdditionCode)=> {
            if (code == AntiAdditionCode.NON_ADULT_NORMAL)
                eventCenter.fire(antiAddictionEvent.SHOW_ANTI_ADDICTION, true)
            // ????????????
            if (userData.universalData.UniversalSageData && userData.universalData.UniversalSageData.IsChoose)
                guiManager.loadScene(SCENE_NAME.MAIN);
            else
                guiManager.loadView("SageQuestionView", null);
                
            this.gotoNextState();
        }, ()=> {
            PackageUtils.logout();
            cc.game.end()
        })
    }

    netLoginFail(eid: number, errdesc: string) {
        guiManager.showTips("????????????:" + errdesc)
        this.isLogining = false;
        guiManager.showMessageBox(
            guiManager.sceneNode,
            {
                content: "?????????????????????????????????????????????",
                leftStr: "??? ???",
                leftCallback: (box: MessageBoxView) => {
                    box.closeView();
                }
            }
        );
    }
}

enum STATE_ENUM {
    START = 0,
    CHECK_UPGRADE,     // ??????
    CHECK_CONFIG,      // ????????????
    SDK_LOGIN,         // ??????sdk
    CHECK_NOTICE,      // ??????
    LOGIN_WORLD,       // ???????????????
    LOGIN_SERVER,      // ???????????????
    FINISH
}

class StateControl {
    private _currStateIdx: number = 0;
    private _state: BaseState[] = [];
    private _callback: Function = null;

    private _getStateInstance(state: STATE_ENUM) {
        let _instance: BaseState = null;
        switch (state) {
            case STATE_ENUM.CHECK_UPGRADE: _instance = new CheckUpgrade(); break;
            case STATE_ENUM.CHECK_CONFIG: _instance = new ConfigUpgrade(); break;
            case STATE_ENUM.SDK_LOGIN: _instance = new LoginSDK(); break;
            case STATE_ENUM.CHECK_NOTICE: _instance = new CheckNotice(); break;
            case STATE_ENUM.LOGIN_WORLD: _instance = new LoginWorld(); break;
            case STATE_ENUM.LOGIN_SERVER: _instance = new LoginServer(); break;
            default:
                logger.error(`can't index of state. state = ${state}`);
                break;
        }
        return _instance;
    }

    start(loginScene: LoginScene, callback?: Function) {
        this._callback = callback;

        this._currStateIdx = STATE_ENUM.START + 1;
        for (let i = STATE_ENUM.START + 1; i < STATE_ENUM.FINISH; i++) {
            this._state[i] = this._getStateInstance(i);
            this._state[i].setStateCtrl(this, loginScene);
        }
        this._state[this._currStateIdx].initialize();
    }

    restart () {
        if (this._state[this._currStateIdx]) {
            this._state[this._currStateIdx].unInitialize();
        }
        this._currStateIdx = STATE_ENUM.START + 1;
        this._state[this._currStateIdx].initialize();
    }

    gotoNextState() {
        this._state[this._currStateIdx].unInitialize();
        if (this._state[this._currStateIdx + 1]) {
            this._currStateIdx++;
            this._state[this._currStateIdx].initialize();
        } else {
            if (this._callback) this._callback();
        }
    }

    gotoState(state: STATE_ENUM) {
        this._state[this._currStateIdx].unInitialize();
        if (this._state[state]) {
            this._state[state].initialize();
            // ????????????????????????????????????????????????????????????index
            this._currStateIdx = state;
        }
    }
}

export let loginState = new StateControl();
