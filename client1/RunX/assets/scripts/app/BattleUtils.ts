import UIClick from "../common/components/UIClick";
import { configManager } from "../common/ConfigManager";
import { logger } from "../common/log/Logger";
import { cfg } from "../config/config";
import { bagData } from "../mvp/models/BagData";
import { battleUIData } from "../mvp/models/BattleUIData";
import { pveData } from "../mvp/models/PveData";
import { pveFakeData } from "../mvp/models/PveFakeData";
import { pvpData } from "../mvp/models/PvpData";
import UIRole from "../mvp/template/UIRole";
import { ANIMATION_GROUP } from "../mvp/views/view-actor/SkillUtils";
import ItemRole from "../mvp/views/view-item/ItemRole";
import { data, gamesvr } from "../network/lib/protocol";
import { INVALID_HERO_TAG } from "./AppConst";
import { HERO_PROP } from "./AppEnums";
import { utils } from "./AppUtils";
import { BACK_ATTACK_ID, BTResult, BT_DEFAULT_POS, DOUBLE_ATTACK_ID, EFFECT_TYPE, HALO_RANGE, NORMAL_ATTACK_ID, PURSUE_ATTACK_ID, ROLE_REBORN_ID, ROLE_RELATIVE_MOVE_Z_INDEX, ROLE_Z_INDEX_INTERVAL, SPUTTER_ATTACK_ID } from "./BattleConst";
import { GetEffectInfo } from "./BattleType";
import { configUtils } from "./ConfigUtils";

const SHOW_BATTLE_LOG = true;

export class BattleUtils {
    private _zindeHelper = 1;

    resetZHelper () {
        this._zindeHelper = 1
    }

    setZIndex(zInddex: number){
        this._zindeHelper = zInddex;
    }

    get zIndexHelper(){
        return this._zindeHelper;
    }

    checkHaloUIRange = (haloOwner: UIRole, target: UIRole, range: HALO_RANGE): boolean => {
        if (!range) return false;
        if (haloOwner.hp <= 0) return false;

        switch (range) {
            case HALO_RANGE.ALL: {
                return true;
            }
            case HALO_RANGE.DEFAULT: {
                return (haloOwner.roleType != target.roleType) && (haloOwner.pos == target.pos);
            }
            case HALO_RANGE.DEFAULT_AROUND: {
                return (haloOwner.roleType != target.roleType) && (Math.abs(haloOwner.pos - target.pos) <= 1);
            }
            case HALO_RANGE.ENEMY_ALL: {
                return (haloOwner.roleType != target.roleType)
            }
            case HALO_RANGE.SELF_AROUND: {
                return (haloOwner.roleType == target.roleType) && (Math.abs(haloOwner.pos - target.pos) <= 1);
            }
            case HALO_RANGE.SELL_ALL: {
                return (haloOwner.roleType == target.roleType);
            }
            default: {
                return false;
            }
        }
        return false;
    }

    getInitZIndex(pos: number): number {
        return pos * ROLE_Z_INDEX_INTERVAL + ROLE_Z_INDEX_INTERVAL - 1;
    }

    updateMoveDefaultZIndex (itemRole: ItemRole) {
        if(itemRole.node) {
            let startZIndex = (itemRole.node && itemRole.node.parent && itemRole.node.parent.zIndex) || 0;
            let roleZIndex = ROLE_RELATIVE_MOVE_Z_INDEX + startZIndex;
            itemRole.changeRoleZIndex(roleZIndex);
        }
    }

    updateMoveZIndex (src: ItemRole, target: ItemRole, group?: ANIMATION_GROUP, isFort?: boolean) {
        if (!src || !src.role) return;
        let userData = src.role;

        if (group) {
            if (group == ANIMATION_GROUP.SOURCE && target && target.role) {
                let roleZIndex = this.getInitZIndex(target.role.pos)
                target.changeRoleZIndex(roleZIndex + this._zindeHelper++);
                src.changeRoleZIndex(roleZIndex + this._zindeHelper++);
                return;
            }

            // ??????????????????????????????
            // if (group == ANIMATION_GROUP.TARGET && target) {
            //     return target.role.pos * 2
            // }
        }
        let targetZIndex = 0;
        if(isFort) {
            if(userData) {
                targetZIndex = this.getInitZIndex(userData.pos);
            }
        } else {
            if(target && target.role) {
                targetZIndex = this.getInitZIndex(target.role.pos);
            } else if(userData) {
                targetZIndex = this.getInitZIndex(userData.pos);
            }
        }

        target.changeRoleZIndex(targetZIndex + this._zindeHelper++);
        src.changeRoleZIndex(targetZIndex + this._zindeHelper++);
    }
    /**
     * ?????????????????????????????????
     * @param source ????????????????????????
     */
    getSubstitutionRoleZIndex(source: ItemRole): number {
        if(!source || !source.role) return 0;
        let roleZIndex = this.getInitZIndex(source.role.pos);
        return roleZIndex;
    }
    /**
     * ???????????? ??????????????????
     * @param src 
     * @param target 
     * @returns 
     */
    getSubStitutionAttackSourceZIndex(src: ItemRole, target: ItemRole) {
        if(!src || !src.role || !target || !target.role) return 0;
        let targetZIndex = target? (this.getInitZIndex(target.role.pos) + this._zindeHelper++) : this.getInitZIndex(src.role.pos);
        return targetZIndex;
    }

    /**
    * ??????????????????????????????????????????
    * @returns 
    */
    getFriendSkillsCanAdd (heroes: number[], candicate: number[]) {
        let skills: number[] = []
        if (heroes.length <= 0) {
            return skills
        }
        const heroList  = heroes;
        const all = heroes.concat(candicate)
        // ????????????????????????????????????
        let own = heroList.filter(_t => { return _t > 0 });
        if (own.length >= 1) {
            for(let i = 0; i < own.length; ++i) {
                let heroId = own[i];
                let cfg = configUtils.getHeroBasicConfig(heroId);
                if (!cfg) continue;
                let friendId: number = cfg.HeroFriendID;
                // ?????????????????????????????? ?????????????????????
                if (friendId && skills.indexOf(friendId) == -1) {
                    if (battleUtils.checkFriendSkillActive(friendId, own) == false 
                     && battleUtils.checkFriendSkillActive(friendId, all) ) {
                        skills.push(friendId)
                    }
                }
            }
        }
        return skills;
    }

    /**
    * ???????????????????????????????????????
    * @returns 
    */
    getFriendSkills(heroes: number[]) {
        let activeSkills: number[] = []
        if (heroes.length <= 0) {
            return activeSkills
        }
        const heroList  = heroes;
        // ????????????????????????????????????
        let filterHeros = heroList.filter(_t => { return _t > 0 });
        if (filterHeros.length >= 1) {
            for(let i = 0; i < filterHeros.length; ++i) {
                let heroId = filterHeros[i];
                let cfg = configUtils.getHeroBasicConfig(heroId);
                if (!cfg) continue;
                let friendId: number = cfg.HeroFriendID;
                // ?????????????????????????????? ?????????????????????
                if (friendId && activeSkills.indexOf(friendId) == -1) {
                    if (battleUtils.checkFriendSkillActive(friendId, filterHeros)) {
                        activeSkills.push(friendId)
                    }
                }
            }
        }
        return activeSkills;
    }

     /**
     * ??????????????????????????????
     * @param friendId 
     * @returns 
     */
    checkFriendSkillActive(friendId: number, all: number[]) {
        let friendCfg: cfg.HeroFriend = configUtils.getHeroFriendConfig(friendId);
        if (!friendCfg || !friendCfg.HeroFriendNeedHero) {
            return false;
        }
        let findCount: number = 0;
        let friends = utils.parseStingList(friendCfg.HeroFriendNeedHero);
        for(let i = 0; i < friends.length; ++i) {
            let heroId: number = Number(friends[i]);
            if (heroId > 0) {
                if(all.indexOf(heroId) > -1) {
                    ++findCount;
                }
            } else {
                return false;
            }
        }
        return findCount >= friends.length;
    }

    getFriendSkillByID (friendId: number) {
        let res: number[] = [];
        let cfg = configUtils.getHeroFriendConfig(friendId);
        if (!cfg || !cfg.HeroFriendNeedHero) return [];

        let friends = utils.parseStingList(cfg.HeroFriendNeedHero);
        res = friends.map(_v=> {
            return  Number(_v)
        })
        return res
    }

    getMonsterPower(monsterId: number): number {
        let monsterCfg = configUtils.getMonsterConfig(monsterId);
        if(monsterCfg) {
            let attributeCfgs: {[k: number]: cfg.Attribute} = configManager.getConfigs('attribute');
            let attackBase = monsterCfg.Attack || 0;
            let defendBase = monsterCfg.Defend || 0;
            let hpBase = monsterCfg.Hp || 0;
            return attackBase * attributeCfgs[HERO_PROP.BASE_ATTACK].PowerAttrRate || 0 
                    + defendBase * attributeCfgs[HERO_PROP.DEFEND].PowerAttrRate || 0
                    + hpBase * attributeCfgs[HERO_PROP.MAX].PowerAttrRate || 0;
        }
        return 0;
    }

    // ???????????????????????????
    getModelMeleeOrLong(id: number): Boolean {
        let modelId: number = 0;
        let heroCfg = configUtils.getHeroBasicConfig(id);
        if(heroCfg) {
            modelId = heroCfg.HeroBasicModel;
        } else {
            let monsterCfg = configUtils.getMonsterConfig(id);
            if(monsterCfg) {
                modelId = monsterCfg.ModelId;
            }
        }
        if(modelId == 0) {
            logger.error('??????????????????????????????????????????:', id);
            return false;
        }
        let modelCfg = configUtils.getModelConfig(modelId);
        return modelCfg && modelCfg.ModelLongRange == 1;
    }

    /**
     * ???????????? ????????????source  ??????????????????????????????????????? section buff????????????  ?????????????????????????????????isLoop
     * @param result 
     * @param getEffectInfo 
     * @returns 
     */
    getEffectId (result: BTResult, getEffectInfo?: GetEffectInfo) {
        let itemId = this.getItemId(result);
        let effectId: number = 0;
        switch(result.ResultType) {
            case gamesvr.ResultType.RTSkillLightResult: {
                if(this.checkIsNormalAttack(itemId)) {
                    if(!getEffectInfo.source) {
                        logger.warn('???????????????????????? itemId: ', itemId, getEffectInfo);
                        return 0;
                    }
                    return getEffectInfo.source.getMoveAttackInfo(itemId);
                } else {
                    return this.getSkillEffectId(itemId, getEffectInfo.section);
                }
                break;
            }
            case gamesvr.ResultType.RTHPResult: {
                let itemType = this.getItemType(itemId);
                if(EFFECT_TYPE.BUFF == itemType) {
                    // buff ?????????????????????Hit
                    return this.getBuffHitTemplateId(itemId);
                } else if(EFFECT_TYPE.SKILL == itemType) {
                    if(this.checkIsNormalAttack(itemId) && result.HPResult && result.HPResult.Delta <= 0) {
                        if(!getEffectInfo.source) {
                            logger.warn('???????????????????????? itemId: ', itemId, getEffectInfo);
                            return 0;
                        }
                        return getEffectInfo.source.getMoveAttackInfo(itemId);
                    } else {
                        return this.getSkillEffectId(itemId, getEffectInfo.section);
                    }
                } else if(EFFECT_TYPE.NORMAL_ATTACK == itemType) {
                    if(!getEffectInfo.source) {
                        logger.warn('???????????????????????? itemId: ', itemId, getEffectInfo);
                        return 0;
                    }
                    return getEffectInfo.source.getMoveAttackInfo(itemId);
                }
                break;
            }
            case gamesvr.ResultType.RTBuffLightResult: {
                return this.getBuffActivityTemplateId(itemId);
                break;
            }
            case gamesvr.ResultType.RTBuffResult: {
                // itemId = result.BuffResult.BuffUID;
                // let buffId = this.getBuffIdByBuffUid(itemId);
                if(getEffectInfo.isLoop) {
                    return this.getBuffLoopTemplateId(itemId);
                } else {
                    return this.getBuffTemplateId(itemId);
                }
            }
            case gamesvr.ResultType.RTHaloResult: {
                let cfg = configUtils.getHaloConfig(itemId)
                if (!cfg) return 0;

                if(getEffectInfo.isLoop) {
                    return cfg.LoopTemplateId? cfg.LoopTemplateId:0;
                } else {
                    return cfg.TemplateID? cfg.TemplateID:0;
                }
            }
            case gamesvr.ResultType.RTRoleReviveResult: {
                return ROLE_REBORN_ID;
                break;
            }
            default: {
                break;
            }
        }
        return effectId;
    }

    checkIsNormalAttack(id: number): boolean {
        return NORMAL_ATTACK_ID == id || DOUBLE_ATTACK_ID == id || PURSUE_ATTACK_ID == id || BACK_ATTACK_ID == id || SPUTTER_ATTACK_ID == id;
    }

    getItemId (result: BTResult) {
        let itemId: number = 0;
        switch(result.ResultType) {
            case gamesvr.ResultType.RTSkillLightResult: {
                itemId = result.SkillLightResult.SkillID;
                break;
            }
            case gamesvr.ResultType.RTHPResult: {
                itemId = result.ItemID;
                break;
            }
            case gamesvr.ResultType.RTBuffLightResult: {
                itemId = result.BuffLightResult.BuffUID;
                let buffId = this.getBuffIdByBuffUid(itemId);
                itemId = buffId;
                break;
            }
            case gamesvr.ResultType.RTBuffResult: {
                itemId = result.BuffResult.BuffID;
                // let buffId = this.getBuffIdByBuffUid(itemId);
                return itemId;
            }
            case gamesvr.ResultType.RTHaloResult: {
                let haloId = result.HaloResult.HaloID;
                itemId =  haloId;
                break;
            }
            default: {
                break;
            }
        }
        return itemId;
    }

    getItemType(id: number): EFFECT_TYPE {
        if(this.checkIsNormalAttack(id)) {
            return EFFECT_TYPE.NORMAL_ATTACK;
        }
        let skillCfg = configUtils.getSkillConfig(id);
        if(skillCfg) {
            return EFFECT_TYPE.SKILL;
        }
        let buffCfg = configUtils.getBuffConfig(id);
        if(buffCfg) {
            return EFFECT_TYPE.BUFF;
        }
        let haloCfg = configUtils.getHaloConfig(id);
        if(haloCfg) {
            return EFFECT_TYPE.HALO;
        }
        return EFFECT_TYPE.INVALID;
    }

    getSkillEffectId(skillId: number, section?: number) {
        let effectId = 0;
        let skillCfg = configUtils.getSkillConfig(skillId);
        if(skillCfg) {
            let templateId = skillCfg.TemplateID;
            if(templateId) {
                if(typeof section == 'undefined') {
                    logger.warn('??????????????????????????? ??????????????????section??? itemId: ', skillId);
                    return effectId;
                }
                if(templateId.indexOf(';') > -1) {
                    let templateList = templateId.split('|');
                    for(let i = 0; i < templateList.length; ++i) {
                        let temp = templateList[i].split(';');
                        let curSection = Number(temp[0]);
                        let curEffectId = Number(temp[1]);
                        effectId = curEffectId;
                        if(section <= curSection) {
                            return effectId;
                        }
                    }
                } else {
                    return Number(templateId);
                }
            }
        } else {    
            logger.warn('skillLight???skillId???????????????????????? itemId: ', skillId);
        }
        return effectId;
    }

    getBuffActivityTemplateId(buffId: number) {
        let buffCfg = configUtils.getBuffConfig(buffId);
        if(buffCfg && buffCfg.EffectTemplateID) {
            return buffCfg.EffectTemplateID;
        }
        return 0;
    }

    getBuffTemplateId(buffId: number) {
        let buffCfg = configUtils.getBuffConfig(buffId);
        if(buffCfg && buffCfg.TemplateID) {
            return buffCfg.TemplateID;
        }
        return 0;
    }

    getBuffHitTemplateId(buffId: number) {
        let buffCfg = configUtils.getBuffConfig(buffId);
        if(buffCfg && buffCfg.HitEffectID) {
            return buffCfg.HitEffectID;
        }
        return 0;
    }

    getBuffLoopTemplateId(buffId: number) {
        let buffCfg = configUtils.getBuffConfig(buffId);
        if(buffCfg && buffCfg.LoopTemplateID) {
            return buffCfg.LoopTemplateID;
        }
        return 0;
    }

    getBuffIdByBuffUid(buffUid: number): number {
        let role = battleUIData.getRoleByBuffUid(buffUid);
        if(role) {
            let iBuff = role.buffList.find(_buff => { return _buff.UID == buffUid; });
            if(iBuff) {
                return iBuff.ID;
            }
        }
        return 0;
    }

    getHaloIdByHaloUid(haloUid: number) {
        let role = battleUIData.getRoleByHaloUid(haloUid);
        if(role) {
            let iHalo = role.haloList.find(_halo => { return _halo.UID == haloUid; });
            if(iHalo) {
                return iHalo.ID;
            }
        }
        return 0;
    }

    /**
     * 
     * @param herosUp ???????????????IDs
     * @param heroId ????????????IDs???????????????????????????????????????
     * @returns 
     */
    getFriendHeroRecommand (herosUpOrigin: number[], heroIdOrigin: number, isFakeHero: boolean = false): boolean {
        if(!herosUpOrigin || herosUpOrigin.length == 0 || !heroIdOrigin) return false;

        let heroId = heroIdOrigin;
        let herosUp = herosUpOrigin;

        if (isFakeHero) {
            heroId = pveFakeData.getRealHeroId(heroId)
            herosUp = [];
            herosUpOrigin.forEach( _oID => {
                let oID = pveFakeData.getRealHeroId(_oID)
                herosUp.push(oID);
            })
        }

        let cfg = configUtils.getHeroBasicConfig(heroId)
        if(!cfg || !cfg.HeroFriendID) return false;

        let frdCfg = configUtils.getHeroFriendConfig(cfg.HeroFriendID);
        if(!frdCfg || !frdCfg.HeroFriendNeedHero) return false;

        let ids = frdCfg.HeroFriendNeedHero.split("|").map(_sid => {return parseInt(_sid)});
        if(!ids || ids.length == 0) return false;

        //??????????????????
        if(ids.indexOf(INVALID_HERO_TAG) != -1) return false;

        return herosUp.some((ele, idx) => {
            if(!ele) return false;
            if(ele == heroId) return false;
            return ids.indexOf(ele) != -1;
        });
    }

    /**
     * @description ??????????????????????????????
     * 1. ?????????????????????????????????????????????????????????????????????
     */
    checkBackAttackMove (source: ItemRole, target: ItemRole ) {
        if (!source || !target) return false
        let sourceID = source.role.id;
        let targetID = target.role.id;

        if (sourceID && targetID && !this.getModelMeleeOrLong(sourceID) && this.getModelMeleeOrLong(targetID)) {
            return true
        }
        return false
    }

    removeClickComp (nodeTarget: cc.Node) {
        if (nodeTarget && cc.isValid(nodeTarget)) {
            let comp = nodeTarget.getComponent(UIClick)
            if (comp && comp.isValid) {
                comp.deInit();
                nodeTarget.removeComponent(UIClick)
            }
        }
    }

    showBattleDetailLog (msg: gamesvr.IEnterBattleResult) {
        if (!SHOW_BATTLE_LOG) return;

        try {
            console.log("------------- ???????????? ----------------")
            let roleMap: Map<number, string> = new Map()
            let buffMap: Map<number, {name: string, id: number}> = new Map()
            if (msg.Teams) {
                msg.Teams.forEach((v,idx) => {
                    console.log(`?????? ${idx+1}, ?????????:`);
    
                    if (idx == 0) {
                        v.Roles.forEach( (r, ridx) => {
                            let heroCfg = configUtils.getHeroBasicConfig(r.ID)
                            console.log(`???${ridx}???${heroCfg.HeroBasicName}, ???????????? = ${r.MaxHP}, ?????? = ${r.MaxPower}, ?????? = ${r.Pos}, Uid = ${r.UID}`)
                            roleMap.set(r.UID, heroCfg.HeroBasicName)
                        })
                    } else {
                        v.Roles.forEach( (r, ridx) => {
                            let monCfg:any = configUtils.getMonsterConfig(r.ID)
                            if (!monCfg && (pveData.magicDoor || pvpData.pvpConfig) ) {
                                let heroCfg = configUtils.getHeroBasicConfig(r.ID)
                                console.log(`???${ridx}???${heroCfg.HeroBasicName}, ???????????? = ${r.MaxHP}, ?????? = ${r.MaxPower}, ?????? = ${r.Pos}, Uid = ${r.UID}`)
                                roleMap.set(r.UID, heroCfg.HeroBasicName)
                                return
                            }
    
                            if (!monCfg) {
                                monCfg = configUtils.getHeroBasicConfig(r.ID)
                                console.log(`???${ridx}???${monCfg.HeroBasicName}, ???????????? = ${r.MaxHP}, ?????? = ${r.MaxPower}, ?????? = ${r.Pos}, Uid = ${r.UID}`)
                                roleMap.set(r.UID, monCfg.HeroBasicName)
                            } else {
                                console.log(`???${ridx}???${monCfg.Name}, ???????????? = ${r.MaxHP}, ?????? = ${r.Pos}, Uid = ${r.UID}`)
                                roleMap.set(r.UID, monCfg.Name)
                            }
                        })
                    }
    
                })
            }
    
            if (msg.BattleStartRes.Results && msg.BattleStartRes.Results.length) {
                console.log("------------- ???????????? ----------------")
                msg.BattleStartRes.Results.forEach(v=> {
                    this._showBattleRes(v, roleMap, buffMap)
                })
            }
    
            if (msg.RoundRes.length) {
                msg.RoundRes.forEach(v=> {
                    console.log(`------------- ?????? ???${v.Round}??? ?????? ----------------`)
                    if (v.RoundStartRes && v.RoundStartRes.length)
                        v.RoundStartRes.forEach ( round => {
                            this._showBattleRes(round, roleMap, buffMap)
                        })
                    console.log(`------------- ?????? ???${v.Round}??? ?????? ----------------`)
    
                    if (v.ActionRes && v.ActionRes.length)
                        v.ActionRes.forEach ( round => {
                            this._showBattleRes(round, roleMap, buffMap)
                        })
                    console.log(`------------- ?????? ???${v.Round}??? ?????? ----------------`)
    
                    if (v.RoundEndRes && v.RoundEndRes.length)
                        v.RoundEndRes.forEach ( round => {
                            this._showBattleRes(round, roleMap, buffMap)
                        })
                })
            }
            if (msg.BattleEndRes.Results && msg.BattleEndRes.Results.length) {
                console.log("------------- ???????????? ----------------")
                msg.BattleEndRes.Results.forEach(v=> {
                    this._showBattleRes(v, roleMap, buffMap)
                })
            }
        } catch (e) {
            logger.warn("[Battle res log err = ]", e)
            return
        }
    }

    private _showBattleRes (msg: gamesvr.IResult, roleMap: Map<number, string>, buffMap: Map<number, {name: string, id: number}>) {
        let sourceStr = ``
        if (msg.ItemID == 500001) {
            sourceStr = `??????`
        } else if (msg.ItemID == 500002) {
            sourceStr = `??????`
        } else if (msg.ItemID == 500004) {
            sourceStr = `??????`
        } else if (msg.ItemID == 500003) {
            sourceStr = `??????`
        } 
    
        let cfg = configManager.getConfigByKey("skill", msg.ItemID)
        if (cfg != null) {
            sourceStr = `${cfg.Name}`
        } else {
            cfg = configManager.getConfigByKey("buff", msg.ItemID)
            if (cfg) {
                sourceStr = `${cfg.Name}`
            }
        }
        
        if (cfg == null) {
            let fromBuff = buffMap.get(msg.From)
            if (fromBuff) {
                sourceStr = fromBuff.name
            } else {
                if(msg.From != 0 && !sourceStr) {
                    console.log("ERR ??????????????? ", msg.From, msg.ItemID)
                }
            }
        }

        if (msg.HPResult) {
            let res = msg.HPResult;
            let desc = "";
            desc = `???${roleMap.get(res.RoleUID)}??? ??HP ${res.Delta}, ??????HP ${res.HP}, ?????????${sourceStr}???, `;
            if (res.DeltaShield) {
                desc += `?????????????? ${res.DeltaShield}, ????????????${res.Shield}`
            }
            if (msg.HPResult.HPDetail) {
                let detail = msg.HPResult.HPDetail
                if (detail.Protect > 0) {
                    desc += `?????????????????? ??????????????????${roleMap.get(res.RoleUID)}?????????????????????${roleMap.get(detail.Protect)}???`
                } 
                if (roleMap.get(msg.From)) {
                    desc += `????????????${roleMap.get(msg.From)}???, `
                }
                if (detail.Attack) {
                    desc += `?????? ${detail.Attack}, `
                }

                if (detail.TrueAttack) {
                    desc += `?????? ${detail.TrueAttack}, `
                }
                if (detail.Crit) {
                    desc += `?????? ${detail.Crit}, `
                }

                if (detail.Miss) {
                    desc += `?????? ${detail.Miss}, `
                }
                if (detail.Vampire) {
                    desc += `?????? ${detail.Vampire}, `
                }

                console.log(desc)
            }
        }

        if (msg.SkillLightResult) {
            let res = msg.SkillLightResult
            let cfg = configUtils.getSkillConfig(res.SkillID)
            let skillStr = cfg?cfg.Name: `????????????${res.SkillID}`
            console.log(`???${roleMap.get(res.RoleUID)}??? ??????${skillStr}`)
        }

        if (msg.BuffLightResult) {
            let res = msg.BuffLightResult
            let buffid = buffMap.get(res.BuffUID).id
            let cfg = configUtils.getBuffConfig(buffid)
            let buffStr = cfg?cfg.Name: `??????buff${buffid}`
            console.log(`???${roleMap.get(res.RoleUID)}?????????buff ${buffStr}`)
        }

        if (msg.TeamBuffLightResult) {
            let res = msg.TeamBuffLightResult
            let cfg = configUtils.getBuffConfig(res.BuffID)
            let buffStr = cfg?cfg.Name: `??????Teambuff${res.BuffID}`
            console.log(`?????????${res.Team}?????????Teambuff ${buffStr}`)
        }

        if (msg.HaloLightResult) {
            let res = msg.HaloLightResult
            let halo = buffMap.get(res.HaloUID)
            let haloId =halo?halo.id : 0
            let cfg = configUtils.getHaloConfig(haloId)
            let buffStr = cfg?cfg.Name: `????????????${haloId}`
            console.log(`???${roleMap.get(res.RoleUID)}??????????????? ${buffStr}`)
        }

        if (msg.PowerResult) {
            let res = msg.PowerResult
            console.log(`???${roleMap.get(res.RoleUID)}??? ??power ${res.Delta}, ??????power ${res.Power}, ?????????${sourceStr}???`)
        }

        if (msg.BuffResult) {
            let res = msg.BuffResult
            let cfg = configUtils.getBuffConfig(res.BuffID)
            if (!buffMap.has(res.BuffUID)) {
                buffMap.set(res.BuffUID, {id: res.BuffID, name: cfg.Name})
            }

            console.log(`???${roleMap.get(res.RoleUID)}???Buff???${cfg.Name}??? ???????? ${res.Delta}, ???????????? ${res.Count}, ?????????${sourceStr}???, uid ${res.BuffUID}`)
        }

        if (msg.TeamBuffResult) {
            let res = msg.TeamBuffResult
            let cfg = configUtils.getBuffConfig(res.BuffID)
            console.log(`?????????${res.Team}?????????Buff???${cfg.Name}??? ???????? ${res.Delta}, ???????????? ${res.Power}, ???????????? ${res.MaxPower}, ?????????${sourceStr}???`)
        }

        if (msg.HaloResult) {
            let res = msg.HaloResult
            let cfg = configUtils.getHaloConfig(res.HaloID)
            if (!buffMap.has(res.HaloUID)) {
                buffMap.set(res.HaloUID, {id: res.HaloID, name: cfg.Name})
            }
            let str = res.isAdd? "??????":"??????"
            console.log(`???${roleMap.get(res.RoleUID)}???${str}?????????${cfg.Name}???, ?????????${sourceStr}???`)
        }

        if (msg.RoleTimerResult) {
            let res = msg.RoleTimerResult
            console.log(`???${roleMap.get(res.RoleUID)}??????????????? ??Pos = ${res.Delta}, Pos = ${res.RolePosition}, ??speed = ${res.SpeedDelta} , speed = ${res.Speed}, ?????????${sourceStr}???`)
        }

        if (msg.RoleDeadResult) {
            let res = msg.RoleDeadResult
            console.log(`???${roleMap.get(res.RoleUID)}??????????????????, ?????????${sourceStr}???`)
        }
    }

    // ??????resultData??????????????????????????????????????????????????????
    // ???????????????x?????????????????????y???????????????????????????????????????????????????????????????
    mergeEffectArray (res: BTResult[]): gamesvr.IResult[][] {
        let findResults = (results: BTResult[], curr: BTResult) => {
            let find = false;
            if (results && results[0] && results[0].From
                && results[0].From == curr.From
                && ((!results[0].Index && curr.Index) || results[0].Index == curr.Index)) {
                find = true;
            }
            return find;
        }
        
        let findResultsIgnoreIdx = (results: BTResult[], curr: BTResult) => {
            let find = false;
            if (results && results[0] && results[0].From
                && results[0].From == curr.From) {
                find = true;
            }
            return find;
        }

        let findResultsByHPResult = (results: BTResult[], curr: BTResult) => {
            let find = false;
            if(results) {
                let headItem = results[0];
                if(headItem && curr.HPResult && headItem.HPResult 
                && ((curr.HPResult.Delta > 0 && headItem.HPResult.Delta > 0) || ( (curr.HPResult.Delta < 0 ||curr.HPResult.DeltaShield < 0) && (headItem.HPResult.Delta < 0 || headItem.HPResult.DeltaShield < 0)))
                && ((!curr.Index && !headItem.Index) || curr.Index == headItem.Index)) {
                    find = true;
                }
            }
            return find;
        }

        let results: BTResult[][] = [];
        let tempResults: BTResult[][] = [];

        // // ???????????????
        // for (let i = 0; i < res.length; i++) {
        //     let _res = res[i];
        //     // ?????????????????????
        //     let currItem = tempResults.find(_t => {
        //         if(_t.length > 0 && _t[0].ResultType == _res.ResultType && _t[0].From == _res.From && _t[0].ItemID == _res.ItemID) {
        //             if(gamesvr.ResultType.RTHPResult == _res.ResultType) {
        //                 return (!_res.Index && !_t[0].Index) || _res.Index == _t[0].Index;
        //             } else {
        //                 return true;
        //             }
        //         }
        //         return false;
        //     });

        //     if (_res.ResultType == gamesvr.ResultType.RTSkillLightResult) {
        //         results = results.concat(tempResults);
        //         tempResults = [[_res]];
        //         // ?????????????????????????????????
        //         // if(res.find(_r => { return _r.ResultType == gamesvr.ResultType.RTHPResult && _r.From ==  _res.SkillLightResult.SkillID; })) {
        //         //     tempResults = [[_res]];
        //         // }
        //         // ?????????effect?????????result???????????????????????????
        //     } else if(_res.ResultType == gamesvr.ResultType.RTHPResult) {
        //         if(findResultsByHPResult(currItem, _res)) {
        //             currItem.push(_res);
        //         } else {
        //             tempResults.push([_res]);
        //         }
        //     } else if (findResults(currItem, _res)) {
        //         currItem.push(_res);
        //     } else if (findResultsIgnoreIdx(currItem, _res)) {
        //         results = results.concat(tempResults);
        //         tempResults = [[_res]]
        //     } else {
        //         if (_res.ResultType == gamesvr.ResultType.RTPowerResult) {
        //             tempResults.push([_res]);
        //             break
        //         }
        //     }
        // }
        // results = results.concat(tempResults);
        tempResults = []
        res.forEach( _res => {
            // let currItem = tempResults[tempResults.length - 1];
            // ?????????????????????
            let currItem = tempResults.find(_t => {
                if(_t.length > 0 && _t[0].ResultType == _res.ResultType && _t[0].From == _res.From && _t[0].ItemID == _res.ItemID) {
                    if(gamesvr.ResultType.RTHPResult == _res.ResultType) {
                        return (!_res.Index && !_t[0].Index) || _res.Index == _t[0].Index;
                    } else {
                        return true;
                    }
                }
                return false;
            });

            if (_res.ResultType == gamesvr.ResultType.RTSkillLightResult) {
                results = results.concat(tempResults);
                tempResults = [[_res]];
            } else if(_res.ResultType == gamesvr.ResultType.RTHPResult) {
                if(findResultsByHPResult(currItem, _res)) {
                    currItem.push(_res);
                } else {
                    tempResults.push([_res]);
                }
            } else if (findResults(currItem, _res)) {
                currItem.push(_res);
            } else if (findResultsIgnoreIdx(currItem, _res)) {
                results = results.concat(tempResults);
                tempResults = [[_res]]
            } else {
                tempResults.push([_res]);
            }
        });
        results = results.concat(tempResults);
        tempResults = [];
        return results
    }

    /**
     * 
     * @param heroID ??????ID
     * @param multiHero ??????????????????????????????
     * @returns ????????????????????????????????????
     */
    getMultiHeroIndex (heroID: number, multiHero?: Map<number, number[]>) {
        if (!multiHero || multiHero.size <= 1 || !heroID) {
            return -1;
        }

        let idx = -1;
        multiHero.forEach( (v, k) => {
            if (v && v.indexOf(heroID) != -1) {
                idx = k
            }
        })
        return idx;
    }

    // ?????????????????????????????????
    parseTeamdata(team: data.ITeamInfo): number[] {
        let newTeam = [0, 0, 0, 0, 0];
        if (!team || !team.Heroes)
            return newTeam;
        for (let key in team.Heroes) {
            let index = parseInt(key);
            newTeam[index] = team.Heroes[key];
        }
        return newTeam;
    }

    /**
     * @desc  ???????????????????????????????????????????????????
     * @param origin ????????????
     * @param banHeros ?????????????????????
     * @param selHeroScope ???????????????????????????????????????????????????????????????????????????????????????????????????
     * @returns
     */
    addFullHero (origin: number[], banHeros?: number[], selHeroScope?: number[]): number[] {
        let results = origin
        //????????????????????????????????????
        if (results.some((_v) => { return _v == 0})) {
            let heroHad = selHeroScope;
            if(!heroHad) {
                let heroUnitHad = bagData.heroList;
                heroUnitHad.sort((hero1,hero2)=>{
                    let heroUnit1 = bagData.getHeroById(hero1.ID);
                    let heroUnit2 = bagData.getHeroById(hero2.ID);
                    return heroUnit2.getCapability() - heroUnit1.getCapability();
                });

                heroUnitHad.forEach(ele => {
                    heroHad = heroHad || [];
                    heroHad.push(ele.ID);
                })
            }
            heroHad = heroHad.filter( _v => {
                return _v && (results.indexOf(_v) == -1 && (!banHeros || banHeros.indexOf(_v) == -1));
            });

            let addIdx = 0;
            BT_DEFAULT_POS.forEach(ele => {
                if(results[ele] == 0 && addIdx < heroHad.length){
                    let heroID = heroHad[addIdx ++];
                    heroID && (results[ele] = heroID);
                }
            });
        }
        if (pveData.pveConfig) {
            //??????????????????
            results.forEach((ele, idx) => {
                if(pveData.checkHeroBan(ele)) {
                    results[idx] = 0;
                }
            })
        }
        return results;
    }

    /**
     * ????????????ID????????????????????????
     * @param monsterID 
     */
    getMonsterMaxEnergy(monsterID: number) {
        let maxEnergy: number = 0;
        let monsterConfig: cfg.Monster = configUtils.getMonsterConfig(monsterID);
        if (monsterConfig && monsterConfig.EnergyLimit > 0) {
            maxEnergy = monsterConfig.EnergyLimit;
        }

        return maxEnergy;
    }

}
export let battleUtils = new BattleUtils();