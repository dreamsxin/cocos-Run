import { bagDataUtils } from "../../../app/BagDataUtils";
import { configUtils } from "../../../app/ConfigUtils";
import { data } from "../../../network/lib/protocol";
import { Equip } from "../../template/Equip";
import { BEAST_RISE_LV_MATERIAL, BEAST_TYPE, QUALITY_TYPE } from "../../../app/AppEnums";
import { utils } from "../../../app/AppUtils";
import { BEAST_RECHANGE_EXP, CustomDialogId, CustomItemId, VIEW_NAME, XUANTIE_TO_EXP } from "../../../app/AppConst";
import { bagData } from "../../models/BagData";
import { bagDataOpt } from "../../operations/BagDataOpt";
import { eventCenter } from "../../../common/event/EventCenter";
import { bagDataEvent } from "../../../common/event/EventData";
import { ViewBaseComponent } from "../../../common/components/ViewBaseComponent";
import ItemMaterial from "./ItemMaterial";
import List from "../../../common/components/List";
import ItemBag from "../view-item/ItemBag";
import RichTextEx from "../../../common/components/rich-text/RichTextEx";
import guiManager from "../../../common/GUIManager";
import moduleUIManager from "../../../common/ModuleUIManager";
import ListItem from "../../../common/components/ListItem";
import MessageBoxView from "../view-other/MessageBoxView";
import { ItemBagPool } from "../../../common/res-manager/NodePool";

enum TOP_SUB_TYPE{
    EQUIP = 1,
    BEAST ,
}
const {ccclass, property} = cc._decorator;

@ccclass
export default class EquipRevertView extends ViewBaseComponent {
    @property(cc.Node) subNodes: cc.Node[] = [];
    @property(cc.Node) emptyNodes: cc.Node[] = [];
    @property(List) inputLists: List[] = [];
    @property(List) outputLists: List[] = [];
    @property(cc.Toggle) qualityTogs: cc.Toggle[] = [];
    @property(cc.Node) revertLayout: cc.Node = null;
    @property(cc.ToggleContainer) nav: cc.ToggleContainer = null;
    @property(cc.Toggle) equipToggle: cc.Toggle = null;
    @property(cc.Label) title: cc.Label = null;

    @property(cc.Label) revertTitleLb: cc.Label = null;
    @property(cc.Label) splitTitleLb: cc.Label = null;

    private _tmpEquip: Equip = new Equip();
    private _subId: number = -1;
    private _topSubId: TOP_SUB_TYPE = -1;
    private _equips: data.IBagUnit[] = [];
    private _output: data.IBagUnit[] = [];

    onInit(moduleId: number, subId: number) {
        if (subId == 0){
            this.onClickRevert();
        }
        if (subId == 1) {
            this.onClickSplit();
        }
        //EXTERNAL_POOL ????????? ?????????????????????????????????
        this.outputLists.forEach(list => {
            if (list.templateType == 3)
                list.setupExternalPool(ItemBagPool);
        })
        this.onClickTopSubToggle(null,TOP_SUB_TYPE.EQUIP.toString())
        this.registerEvent(); 
        guiManager.addCoinNode(this.node, moduleId);
    }

    onRelease(){
        this.outputLists.forEach(list =>{
            list._deInit();
        })
        this.inputLists.forEach(list =>{
            list._deInit();
        })
        guiManager.removeCoinNode(this.node);
        eventCenter.unregisterAll(this);
    }

    onRefresh(){
        if (this._subId == 0)
            this.showRevertCost();
    }

    registerEvent(){
        eventCenter.register(bagDataEvent.SPLIT_SUCCESS, this, this._onSplitSuccess);
        eventCenter.register(bagDataEvent.REVERT_SUCCESS, this, this._onRevertSuccess);
    }

    onClickSplit() {
        if (this._subId == 1) return; this._subId = 1;
        this._resetTopToggle()
        this.subNodes.forEach((node, idx) => {
            node.active = (idx == this._subId);
        })
        this.inputLists[this._subId].node.active = true;
        this.inputLists[this._subId].numItems = this._equips.length;
        this.resetToggleState();
        this.showSplitOutput()
        this.resetQualityToggleState();
        this.title.string = "??????";
    }

    onClickTopSubToggle(touch: any, customData: string) {
        let id = Number(customData)
        if (id == this._topSubId) return;
        this._topSubId = id;

        this._resetTopToggle();

        //????????????-???????????? ???????????????????????????????????????
        this._tmpEquip = new Equip();

        this.resetToggleState();
        this.resetQualityToggleState();

        this.inputLists[this._subId].numItems = this._equips.length;
        // this.inputLists[this._subId].selectedId = -1;
        this.showRevertOutput();
        this.showSplitOutput();
    }

    onClickRevert() {
        if (this._subId == 0) return; this._subId = 0; 
        this._resetTopToggle()
        this.subNodes.forEach((node, idx) => {
            node.active = (idx == this._subId);
        })

        this.inputLists[this._subId].node.active = true;
        this.inputLists[this._subId].numItems = this._equips.length;
        this.resetToggleState();
        this.showRevertOutput();
        this.showRevertCost(true);
        this.resetQualityToggleState();
        this.title.string = "??????";
    }

    onClickQualityToggle(target: cc.Toggle) {
        // ????????????
        let toggleIdx = this.qualityTogs.indexOf(target);
        let qualified = this._equips.filter(equip =>{
            this._tmpEquip.setData(equip);
            let quality = this._tmpEquip.equipCfg ? this._tmpEquip.equipCfg.Quality : this._tmpEquip.beastCfg?.BeastQuality;
            return quality == toggleIdx + 2;
        });
        if (!qualified.length){
            target.isChecked = false;
            guiManager.showDialogTips(CustomDialogId.REVERT_NO_EQUIP);
            return;
        }

        let quality: number[] = [];
        let select: number[] = this.inputLists[this._subId].getMultSelected();
        // // ?????????SSR??????
        this._equips.forEach((euip, idx) => {
            let config = configUtils.getEquipConfig(euip.ID);
            
        })

        if (target.isChecked) {
            this._equips.forEach((euip, idx) => {
                let config = configUtils.getEquipConfig(euip.ID);
                let beastConfig = configUtils.getBeastConfig(euip.ID);
                let quality = config ? config.Quality : (beastConfig ? beastConfig.BeastQuality : null);
                let index = select.indexOf(idx);
                if (quality == toggleIdx + 2 && index == -1) {
                    select.push(idx);
                };
            })
        } else{
            this._equips.forEach((euip, idx) => {
                let config = configUtils.getEquipConfig(euip.ID);
                let beastConfig = configUtils.getBeastConfig(euip.ID);
                let quality = config ? config.Quality : (beastConfig ? beastConfig.BeastQuality : null);
                let index = select.indexOf(idx);
                if (quality == toggleIdx + 2) {
                    select.splice(index, 1);
                };
            })
        }
        this.inputLists[this._subId].setMultSelected(select, true);
        this.refreshQualityToggleState();
        this.showSplitOutput();
    }

    onClickSplitBtn(){
        let selecetMap = this.inputLists[this._subId].getMultSelected();
        let equips: data.IBagUnit[] = [];
        let haveSSR = false;
        if (selecetMap.length > 0) {
            equips = selecetMap.map(sId =>{
                return this._equips[sId]
            })
            equips.forEach(equip =>{
                this._tmpEquip.setData(equip);
                let quality = this._tmpEquip.equipCfg ? this._tmpEquip.equipCfg.Quality : this._tmpEquip.beastCfg?.BeastQuality;
                if (quality == QUALITY_TYPE.SSR){
                    haveSSR = true;
                }
            })
        }
        if (equips.length > 0){
            let cfg = configUtils.getDialogCfgByDialogId(2000016);
            if (cfg && haveSSR) {
                guiManager.showMessageBoxByCfg(this.node, cfg, (msgBox: MessageBoxView) => {
                    msgBox.closeView();
                }, (msgBox: MessageBoxView) => {
                    msgBox.closeView();
                    bagDataOpt.sendEquipSplitRequest(equips);
                });
            } else
                bagDataOpt.sendEquipSplitRequest(equips);
        } else{
            guiManager.showTips("??????????????????????????????");
        }
    }


    onClickRevertBtn() {
        let sId = this.inputLists[this._subId].selectedId;
        let equip = this._equips[sId];
        if (equip) {
            let cfg = configUtils.getDialogCfgByDialogId(2000017);
            if (cfg){
                guiManager.showMessageBoxByCfg(this.node, cfg, (msgBox: MessageBoxView)=>{
                    msgBox.closeView();
                }, (msgBox: MessageBoxView) => {
                    msgBox.closeView();
                    bagDataOpt.sendEquipRevertRequest(equip.ID, equip.Seq);
                });
            } else
                bagDataOpt.sendEquipRevertRequest(equip.ID, equip.Seq);
        } else {
            guiManager.showTips("??????????????????????????????");
        }
    }

    resetToggleState() {
        this.nav.toggleItems.forEach((toggle, idx) => {
            toggle.isChecked = idx == this._subId;
        })
    }

    // ????????????????????????
    resetQualityToggleState(){
        this.qualityTogs.forEach((toggle, idx) => {
            toggle.isChecked = false;
        })
        // ????????????????????????
        this.inputLists[this._subId] && this.inputLists[this._subId].node.active &&
            this.inputLists[this._subId].setMultSelected([], null);
    }

    // ????????????????????????
    refreshQualityToggleState(){
        let nCheck = !!this._equips.length, rCheck = !!this._equips.length, srCheck = !!this._equips.length;
        let nCount = 0, rCount = 0, srCount = 0; 
        let selecetdMap = this.inputLists[this._subId].getMultSelected();
        this._equips.forEach((euip, idx) => {
            let config = configUtils.getEquipConfig(euip.ID);
            let beastConfig = configUtils.getBeastConfig(euip.ID);
            let quality = config ? config.Quality : (beastConfig ? beastConfig.BeastQuality : null);
            if (selecetdMap.indexOf(idx) == -1) {
                if (quality == 2) nCheck = false;
                if (quality == 3) rCheck = false;
                if (quality == 4) srCheck = false;
            }; 
            if (quality == 2) nCount += 1;
            if (quality == 3) rCount += 1;
            if (quality == 4) srCount += 1;
        })
        this.qualityTogs[0].isChecked = nCheck && !!nCount;
        this.qualityTogs[1].isChecked = rCheck && !!rCount;
        this.qualityTogs[2].isChecked = srCheck && !!srCount;
    }

    onSplitListRender(itemNode: cc.Node, idx: number) {
        let itemComp = itemNode.getComponent(ItemMaterial);
        this._tmpEquip.setData(this._equips[idx]);
        if (this._tmpEquip.equipCfg){
            itemComp.isEquipment = true;
            itemComp.clear();
            itemComp.updateIcon(this._tmpEquip.equipCfg.Icon);
            itemComp.updateSuitIcon(this._tmpEquip.equipCfg.SuitId);
            itemComp.updateLevel(this._tmpEquip.getEquipLevel());
            itemComp.updateQuality(this._tmpEquip.equipCfg.Quality);
            itemComp.updateStar(this._equips[idx]?.EquipUnit?.Star || 0);
        } else if (this._tmpEquip.beastCfg) {
            itemComp.updateIcon(this._tmpEquip.beastCfg.BeastHeadImage);
            itemComp.updateLevel(this._tmpEquip.getEquipLevel());
            itemComp.updateQuality(this._tmpEquip.beastCfg.BeastQuality);
            itemComp.updateStar(this._equips[idx]?.EquipUnit?.Star || 0);
        }


    }

    onOutListRender(itemNode: cc.Node, idx: number){
        let itemComp = itemNode.getComponent(ItemBag);
        let equipCfg = configUtils.getEquipConfig(this._output[idx].ID);
        let itemCfg = configUtils.getItemConfig(this._output[idx].ID);
        let beastCfg = configUtils.getBeastConfig(this._output[idx].ID);
        if (equipCfg) {
            this._tmpEquip.setData(this._output[idx]);
            itemComp.init({
                id: this._output[idx].ID,
                count: this._output[idx].Count,
                level: this._tmpEquip.getEquipLevel(),
                star: this._tmpEquip.equipData.EquipUnit.Star,
                clickHandler: () => {
                    moduleUIManager.showItemDetailInfo(this._output[idx].ID, this._output[idx].Count, this.node);
                }
            })
        } else if (itemCfg || beastCfg) {
            itemComp.init({
                id: this._output[idx].ID,
                count: this._output[idx].Count,
                clickHandler: () => {
                    moduleUIManager.showItemDetailInfo(this._output[idx].ID, this._output[idx].Count, this.node);
                }
            })
        } 
        
    }

    onSplitListSelectRender(itemNode: cc.Node, idx: number) {
        // ????????????
        let listItem = itemNode.getComponent(ListItem);
        let isSelect = listItem && listItem.selected;
        if (idx || idx == 0) {
            // let config = configUtils.getEquipConfig(this._equips[idx].ID);
            // ssr??????????????????
            // if (config.Quality == QUALITY_TYPE.SSR) {
            //     let ssrIdx: number[] = [];
            //     this._equips.forEach((euip, idx) => {
            //         let config = configUtils.getEquipConfig(euip.ID);
            //         if (config.Quality != QUALITY_TYPE.SSR) {
            //             ssrIdx.push(idx);
            //         };
            //     })
            //     this.inputLists[this._subId].setMultSelected(ssrIdx, false);
            //     this.refreshQualityToggleState();
            // } else{
            //     let ssrIdx: number[] = [];
            //     this._equips.forEach((euip, idx) => {
            //         let config = configUtils.getEquipConfig(euip.ID);
            //         if (config.Quality == QUALITY_TYPE.SSR) {
            //             ssrIdx.push(idx);
            //         };
            //     })
            //     this.inputLists[this._subId].setMultSelected(ssrIdx, false);
            //     this.refreshQualityToggleState();
            // }
        }
        this.refreshQualityToggleState();
        this.showSplitOutput();
    }

    onRevertListSelectRender(itemNode: cc.Node, idx: number){
        this.showRevertOutput();
        this.showRevertCost();
    }

    onRevertListRender(itemNode: cc.Node, idx: number) {
        let itemComp = itemNode.getComponent(ItemMaterial);
        this._tmpEquip.setData(this._equips[idx]);
        if (this._tmpEquip.equipCfg) {
            itemComp.isEquipment = true;
            itemComp.clear();
            itemComp.updateIcon(this._tmpEquip.equipCfg.Icon);
            itemComp.updateSuitIcon(this._tmpEquip.equipCfg.SuitId);
            itemComp.updateLevel(this._tmpEquip.getEquipLevel());
            itemComp.updateQuality(this._tmpEquip.equipCfg.Quality);
            itemComp.updateStar(this._equips[idx].EquipUnit.Star);
        }else if (this._tmpEquip.beastCfg) {
            itemComp.updateIcon(this._tmpEquip.beastCfg.BeastHeadImage);
            // itemComp.updateSuitIcon(this._tmpEquip.beastCfg.);
            itemComp.updateLevel(this._tmpEquip.getEquipLevel());
            itemComp.updateQuality(this._tmpEquip.beastCfg.BeastQuality);
            itemComp.updateStar(this._equips[idx].EquipUnit.Star);
        }
    }

    private _onSplitSuccess(cmd: any, prize: data.IItemInfo[]){
        if (prize && prize.length)
            this.loadSubView(VIEW_NAME.GET_ITEM_VIEW, prize)
        this._subId = -1;
        this.onClickSplit();
    }

    private _onRevertSuccess(cmd: any, equip: data.IBagUnit, prize: data.IItemInfo[]) {
        if (equip){
            prize.push({ID: equip.ID, Count: 1})
            this.loadSubView(VIEW_NAME.GET_ITEM_VIEW, prize)
        }
        this._subId = -1;
        this.onClickRevert();
    }

    showSplitOutput(){
        let selecetMap = this.inputLists[this._subId].getMultSelected();
        this._output.splice(0);
        if (selecetMap.length > 0){
            selecetMap.forEach(sId => {
                this._output = this._output.concat(this.getEquipSplitResult(this._equips[sId]));
            });
            this._output = this.deal(this._output);
            this.outputLists[this._subId].numItems = this._output.length;
        } else {
            this.outputLists[this._subId].numItems = 0;
        }
    }

    showRevertOutput(){
        let sId = this.inputLists[this._subId].selectedId;
        if (this._equips[sId]){
            this._output = this.getEquipRevertResult(this._equips[sId]);
            this.outputLists[this._subId].numItems = this._output.length;
        } else {
            this.outputLists[this._subId].numItems = 0;
        }
    }

    showRevertCost(reset?: boolean){
        let cost = !reset ? configUtils.getConfigModule("EquipReductionNeed") : 0;
        let own = bagData.diamond;
        this.revertLayout.getComponentInChildren(RichTextEx).string = cost <= own ? `${cost}` : `<color = #ff0000>${cost}</c>`
    }

    getShowEquips(){
        let equips = bagDataUtils.getNotDressEquips();

        equips.sort((a, b) => {
            return bagDataUtils.getEquipExpProvide(a) - bagDataUtils.getEquipExpProvide(b);
        });
        equips.sort((a, b) => {
            let configA = configUtils.getEquipConfig(a.ID);
            let configB = configUtils.getEquipConfig(b.ID);
            return configA.Quality - configB.Quality;
        });
        // ???????????????????????????????????????
        if (this._subId == 0){
            equips = equips.filter(bagUnit => {
                return (!!bagUnit.EquipUnit.Exp || bagUnit.EquipUnit?.Star > 1);
            })
        }
        return equips;
    }

    getShowBeasts() {
          //??????
          let equips = bagDataUtils.getNotDressBeast();
          equips.sort((a, b) => {
              return bagDataUtils.getBeastExpProvide(a) - bagDataUtils.getBeastExpProvide(b);
          });
          equips.sort((a, b) => {
              let configA = configUtils.getBeastConfig(a.ID);
              let configB = configUtils.getBeastConfig(b.ID);
              return configA.BeastQuality - configB.BeastQuality;
          });
          // ???????????????????????????????????????
          if (this._subId == 0){
              equips = equips.filter(bagUnit => {
                  return (!!bagUnit.EquipUnit.Exp || bagUnit.EquipUnit.Star);
              })
          }
          return equips;
    }

    // ????????????
    getEquipSplitResult(equip: data.IBagUnit) {
        if (!equip) return [];
        this._tmpEquip.setData(equip);
        // ????????????
        let decomposeItems: data.IBagUnit[] = [];
        if (this._tmpEquip.beastCfg && this._tmpEquip.beastCfg.BeastDecomposeItem
            && this._tmpEquip.beastCfg.BeastDecomposeItem.length > 0) {
            utils.parseStingList(this._tmpEquip.beastCfg.BeastDecomposeItem, (strArr: string[]) => {
                if(!strArr || strArr.length == 0) return;
                decomposeItems.push(bagDataUtils.buildDefaultItem(parseInt(strArr[0]), parseInt(strArr[1])));
            });
        }else if (this._tmpEquip.equipCfg && this._tmpEquip.equipCfg.DecomposeItem
            && this._tmpEquip.equipCfg.DecomposeItem.length > 0) {
            utils.parseStingList(this._tmpEquip.equipCfg.DecomposeItem, (strArr: string[]) => {
                if(!strArr || strArr.length == 0) return;
                decomposeItems.push(bagDataUtils.buildDefaultItem(parseInt(strArr[0]), parseInt(strArr[1])));
            });
        }
        // ????????????
        let totalEXP = 0;
        if (this._topSubId == TOP_SUB_TYPE.BEAST) {
            totalEXP = bagDataUtils.getBeastExpProvide(equip);
        } else if (this._topSubId == TOP_SUB_TYPE.EQUIP) {
            totalEXP = bagDataUtils.getEquipExpProvide(equip);
        }
        
        //???????????????????????????
        let enhanceGold = bagDataUtils.getEnhanceGoldMulti() * equip.EquipUnit.Exp;
        let breakGold = 0;
        // ??????????????????
        let breakItems: data.IBagUnit[] = [];
        if (this._tmpEquip.equipData?.EquipUnit?.Star > this._tmpEquip.getEquipBeginStarByUnit()){
            let breakCount = this._tmpEquip.equipData.EquipUnit.Star - this._tmpEquip.getEquipBeginStarByUnit();
            let useSelfCount = this._tmpEquip.equipData.EquipUnit.UseSelfCount || 0;
            // ????????????
            // if (breakCount - useSelfCount > 0){
            //     let univerSal = configUtils.getConfigModule("EquipBreachUseReplaceItem");
            //     let parseRes = utils.parseStingList(univerSal).filter(res => {
            //         return res[0] == this._tmpEquip.equipCfg.Quality;
            //     })[0];
            //     breakItems.push(bagDataUtils.buildDefaultItem(Number(parseRes[1]), breakCount - useSelfCount));
            // }
            // ???????????????????????????????????????
            if (decomposeItems) {
                decomposeItems.forEach(item => {
                    item.Count *= (useSelfCount + 1);
                })
            }
            if (this._topSubId == TOP_SUB_TYPE.BEAST) {
                totalEXP += bagDataUtils.getBeastExpProvide(bagDataUtils.buildDefaultEquip(equip.ID)) * useSelfCount;    
            } else if (this._topSubId == TOP_SUB_TYPE.EQUIP) {
                totalEXP += bagDataUtils.getEquipExpProvide(bagDataUtils.buildDefaultEquip(equip.ID)) * useSelfCount;
            }
            

            // ??????????????????
            let tmpEquip = bagDataUtils.buildDefaultEquip(equip.ID);
            // let defaultEquip = bagDataUtils.buildDefaultEquip(equip.ID);
            for (let k = this._tmpEquip.getEquipBeginStarByUnit(); k <= this._tmpEquip.equipData.EquipUnit.Star; k++) {
                let mats: data.IBagUnit[] = [];
                tmpEquip.EquipUnit.Star = k;
                this._tmpEquip.setData(tmpEquip);
                mats = this._tmpEquip.getBreakMaterial();
                mats.shift();
                breakItems = breakItems.concat(mats);

                // ????????????????????????????????????????????????
                // let selfBreakItems = this.convertExpToItem(bagDataUtils.getEquipExpProvide(defaultEquip))
                breakItems = breakItems.concat()
            }
            breakGold = bagDataUtils.getBreakGold(this._tmpEquip) * breakCount;
        }

        
        let expItems: data.IBagUnit[] = []
        if (this._topSubId == TOP_SUB_TYPE.BEAST) {
            expItems = this.convertBeastExpToItem(totalEXP,this._tmpEquip.beastCfg.BeastType || 1);
        } else if(this._topSubId == TOP_SUB_TYPE.EQUIP){
            expItems = this.convertExpToItem(totalEXP);
        }

        return decomposeItems.concat(expItems, breakItems, [bagDataUtils.buildDefaultItem(CustomItemId.GOLD, enhanceGold + breakGold)]);
    }

    // ????????????
    getEquipRevertResult(equip: data.IBagUnit) {
        this._tmpEquip.setData(equip);
        let initialEquip = [bagDataUtils.buildDefaultEquip(equip.ID)];
        // ??????????????????(????????????????????????)
        let expItems = this.convertExpToItem(equip.EquipUnit.Exp);
        //???????????????????????????
        let enhanceGold = bagDataUtils.getEnhanceGoldMulti() * equip.EquipUnit.Exp;
        let breakGold = 0;
        // ??????????????????
        let breakItems: data.IBagUnit[] = [];
        if (this._tmpEquip.equipData.EquipUnit.Star > this._tmpEquip.getEquipBeginStarByUnit()) {
            // let breakCount = this._tmpEquip.equipData.EquipUnit.Star - this._tmpEquip.getEquipBeginStarByUnit();
            //????????????????????? - ??????
            let breakCount = bagDataUtils.checkoutBreakCount(this._tmpEquip);
            let useSelfCount = this._tmpEquip.equipData.EquipUnit.UseSelfCount || 0;
            // ??????????????? n????????? ????????? >n?????????????????????????????????????????????
            if (breakCount - useSelfCount > 0) {
                let univerSal = "";
                if (this._tmpEquip.equipCfg) 
                    univerSal = configUtils.getConfigModule("EquipBreachUseReplaceItem");
                if(this._tmpEquip.beastCfg)
                    univerSal = configUtils.getConfigModule("BeastBreachUseReplaceItem");
                let parseRes = utils.parseStingList(univerSal).filter(res => {
                    if (this._tmpEquip.equipCfg) {
                        return res[0] == this._tmpEquip.equipCfg.Quality;
                    } else if (this._tmpEquip.beastCfg) {
                        return res[0] == this._tmpEquip.beastCfg.BeastQuality;
                    }
                    return false;
                })[0];

                if (parseRes && parseRes.length) {
                    breakItems.push(bagDataUtils.buildDefaultItem(Number(parseRes[1]), breakCount - useSelfCount));    
                }
            }

            // ??????????????????
            let tmpEquip = bagDataUtils.buildDefaultEquip(equip.ID);
            for (let k = this._tmpEquip.getEquipBeginStarByUnit(); k < this._tmpEquip.equipData.EquipUnit.Star; k++) {
                let mats: data.IBagUnit[] = [];
                tmpEquip.EquipUnit.Star = k;
                let tempEquip = new Equip();
                tempEquip.setData(tmpEquip);
                mats = tempEquip.getBreakMaterial();
                mats.shift();
                breakItems = breakItems.concat(mats);
            }
            // ????????????????????????(????????????????????????)
            if (useSelfCount)
                initialEquip = initialEquip.concat(new Array<data.IBagUnit>(useSelfCount).fill(bagDataUtils.buildDefaultEquip(equip.ID)));
            
            breakGold = bagDataUtils.getBreakGold(this._tmpEquip);
        }
        let materials = this.deal(expItems.concat(breakItems, bagDataUtils.buildDefaultItem(CustomItemId.GOLD, enhanceGold + breakGold)));
        return initialEquip.concat(materials);
    }


    /**
     * 
     * @param exp ?????????
     * @param type ????????????
     * @returns 
     */
    convertBeastExpToItem(exp: number,type:number): data.IBagUnit[]{
        let items: data.IBagUnit[] = [], itemID = 0;
        switch (type) {
            case BEAST_TYPE.FEI_QIN: itemID = BEAST_RISE_LV_MATERIAL.FEI_QIN; break;
            case BEAST_TYPE.ZOU_SHOU: itemID = BEAST_RISE_LV_MATERIAL.ZOU_SHOU; break;
            case BEAST_TYPE.SHUI_ZU: itemID = BEAST_RISE_LV_MATERIAL.SHUI_ZU; break;
        }
        items.push(bagDataUtils.buildDefaultItem(itemID, Math.round(exp / BEAST_RECHANGE_EXP)));
        return items;
    }

    convertExpToItem(exp: number): data.IBagUnit[]{
        let items: data.IBagUnit[] = [];
    
        items.push(bagDataUtils.buildDefaultItem(CustomItemId.XUANTIE, Math.round(exp / XUANTIE_TO_EXP)));
        return items;
    }

    deal(data: data.IItemInfo[]) {
        let itemList: data.IItemInfo[] = utils.mergeItemList(data);
        // ????????????: ??????????????????>>>??????????????????
        itemList.sort((_itemA, _itemB) => {
            let qA = configUtils.getItemConfig(_itemA.ID).ProduceOrder;
            let qB = configUtils.getItemConfig(_itemB.ID).ProduceOrder;
            return qB - qA;
        });
        itemList.sort((_itemA, _itemB) => {
            let qA = configUtils.getItemConfig(_itemA.ID).ItemQuality;
            let qB = configUtils.getItemConfig(_itemB.ID).ItemQuality;
            return qB - qA;
        });
        return itemList;
    }

    private _resetTopToggle() {
        if (this._topSubId == TOP_SUB_TYPE.EQUIP && !this.equipToggle.isChecked) {
            this.equipToggle.isChecked = true;
        }

        let topTypeStr = this._topSubId == TOP_SUB_TYPE.EQUIP ? "??????" : "??????";

        //??????title??????
        if (this._subId == 0) {
            this.revertTitleLb.string = '???????????????' + topTypeStr + '?????????????????????';
        } else {
            this.splitTitleLb.string = '????????????????????????' + topTypeStr + '?????????????????????';
        }

        //???????????????????????????
        if (this._topSubId == TOP_SUB_TYPE.BEAST) {
            this._equips = this.getShowBeasts();
        } else {
            this._equips = this.getShowEquips();
        }
        
        //?????????????????????
        this.emptyNodes.forEach((node, idx) => {
            node.active = (idx == this._subId)
                && !this._equips.length;
            if (node.active) {
                let lb = node.getComponentInChildren(cc.Label);
                if (!lb) return;
                let resulst = this._subId == 0 ? "??????" : "??????";
                lb.string = '?????????' + resulst + topTypeStr;
            }
        })

        //??????????????????
        this.inputLists.forEach((input, idx) => {
            if (input.node.active && cc.isValid(input.node, true)) {
                input.numItems = 0;
                input.selectedId = -1;
                let resultMap = input.getMultSelected();
                if (resultMap && resultMap.length > 0) {
                    input.setMultSelected([], null);  
                } 
            }
        })
    }
}
