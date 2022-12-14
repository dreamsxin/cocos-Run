const { ccclass, property } = cc._decorator;

import blurManager from "../common/BlurManager";
import FloatTips from "../common/components/FloatTips";
import { configManager } from "../common/ConfigManager";
import guiManager from "../common/GUIManager";
import {scheduleManager} from "../common/ScheduleManager";
import { modelManager } from "../mvp/models/ModeManager";
import { optManager } from "../mvp/operations/OptManager";
import LoadingView from "../mvp/views/view-loading/LoadingView";
import WaitingView from "../mvp/views/view-loading/WaitingView";
import { appCfg } from "./AppConfig";
import { audioManager } from "../common/AudioManager";
import skillDisplayManager from "../mvp/views/view-actor/SkillDisplayManager";
import resourceLoader from "../common/res-manager/ResourceLoader";
import engineHook from "./EngineHook";
import { eventCenter } from "../common/event/EventCenter";
import { antiAddictionEvent, commonEvent, loginEvent, netEvent } from "../common/event/EventData";
import moduleUIManager from "../common/ModuleUIManager";
import AntiAddictionComp from "../mvp/views/view-antiaddition/AntiAddictionComp";
import materialHelper from "../shader/MaterialHelper";
import netStatusWatcher from "../common/components/NetStatusWatcher";
import { serverTime } from "../mvp/models/ServerTime";
import VideoManager from "../common/VideoManager";
import { FunctionGuideManager } from "../mvp/views/view-guide/FunctionGuideView";
import { AntiAdditionCode } from "./AppEnums";
import { localStorageMgr, SAVE_TAG } from "../common/LocalStorageManager";
import { operationSvr } from "../network/OperationSvr";
import PackageUtils from "./PackageUtils";

@ccclass
export default class App extends cc.Component {
    @property(cc.Node) sceneNode: cc.Node = null;
    @property(cc.Node) floatTips: cc.Node = null;
    @property(cc.Node) taskTips: cc.Node = null;
    @property(cc.Prefab) coinNode: cc.Prefab = null;
    @property(cc.Node) nodeGameLoading: cc.Node = null;
    @property(LoadingView) loadingView: LoadingView = null;
    @property(WaitingView) waitingView: WaitingView = null;
    @property(cc.Material) blur: cc.Material = null;
    @property(sp.SkeletonData) touchSkeleton: sp.SkeletonData = null;
    @property(cc.Boolean) isDebug: boolean = false;
    @property(AntiAddictionComp) antiAddiction: AntiAddictionComp = null;
    @property(cc.Node) netRoot: cc.Node = null;
    @property(VideoManager) videoManager: VideoManager = null;

    private _floatTips: FloatTips = null;
    private _taskTips: FloatTips = null;
    private _gfxNode: cc.Node = null;
    
    onLoad() {
        const allKeys = materialHelper.allNeedPreloadKeys;
        allKeys.forEach(k => {
            materialHelper.preloadItem(k, () => {});
        });
    }

    deInit() {
        FunctionGuideManager.getIns().unInit();
        eventCenter.unregisterAll(this);
        this.videoManager.onRelease();
    }

    start() {
        cc.game.addPersistRootNode(this.node);
        cc.game.setFrameRate(60);
        cc.game.on(cc.game.EVENT_SHOW, this._onGameResume, this);
        cc.debug.setDisplayStats(appCfg.debug.showFps);
        
        engineHook.initialize();

        if (cc.sys.isNative) {
            // @ts-ignore
            jsb.Device.setKeepScreenOn(true);
        }

        this._registerEvent();
        this._floatTips = this.floatTips.getComponent("FloatTips");
        this._taskTips = this.taskTips.getComponent("FloatTips");
        this._initGlobalTouchGfx();

        scheduleManager.init(this);
        guiManager.init({
            appIns: this,
            sceneNode: this.sceneNode,
            tips: this._floatTips,
            taskTips: this._taskTips,
            loadingView: this.loadingView,
            waitingView: this.waitingView,
            gameloadingNode: this.nodeGameLoading,
            coinNode: this.coinNode,
        }, this.isDebug);

        moduleUIManager.init(this.sceneNode);
        blurManager.init(this.blur);
        configManager.init();
        modelManager.init();
        optManager.init();
        audioManager.init();
        skillDisplayManager.init();
        FunctionGuideManager.getIns().init(this.node);

        netStatusWatcher.init(this.netRoot);

        resourceLoader.captureSystem();

        // @ts-ignore
        window.NotifyInitComplete = (succ : boolean) => {
            eventCenter.fire(loginEvent.SDK_INIT_COMPLETE, succ);
        }

        // @ts-ignore
        window.NotifyLogin = (succ: string, userId: string, session: string, platform: string) => {
            if (succ == "true") {
                eventCenter.fire(loginEvent.SDK_LOGIN_SUCC, userId, session, platform);
            } else {
                eventCenter.fire(loginEvent.SDK_LOGIN_FAIL);
            }
        }

        // @ts-ignore
        window.NotifyChangeAccount = () => {
            guiManager.loadScene('LoginScene');
        }

        // @ts-ignore
        window.NotifyLogout = () => {
            modelManager.deInit();
            if (guiManager.currScene() != "LoginScene") {
                guiManager.loadScene('LoginScene');
            } else {
                eventCenter.fire(loginEvent.SDK_LOGOUT);
            }
        }

        // @ts-ignore
        window.NotifyPaySucc = () => {
        }

        // @ts-ignore
        window.NotifyAuth = (succ: boolean) => {
            eventCenter.fire(loginEvent.SDK_AUTH, succ);
        }

        this.antiAddiction.init();
        this.videoManager.onInit();
        this.schedule(this._mainScheduleCallFunc, 1);

        if(cc.sys.isNative){
            guiManager.loadScene('GameTipsScene', () => {
                this._realStart();
            });
            return;
        }
        this._realStart();
    }

    private _registerEvent () {
        eventCenter.register(antiAddictionEvent.SHOW_ANTI_ADDICTION, this, this._showAntiAddiction);
        eventCenter.register(antiAddictionEvent.ANTI_ADDICTION_TIMEOUT, this, this._showAntiAddictionTimeOut);
        eventCenter.register(commonEvent.CAPABILITY_CHANGE, this, this._playCapabilityChange);
        eventCenter.register(commonEvent.GLOBAL_TIPS, this, this._showGlobalTips);
        eventCenter.register(commonEvent.NEW_TASK_FINISHED, this, this._showTaskTips);
        eventCenter.register(commonEvent.CHECKOUT_ACCOUNT, this, this._onCheckoutAccount);
        eventCenter.register(commonEvent.SVR_ERROR, this, this._onSvrErrorResponse);
    }

    private _realStart(){
        let palyed = localStorageMgr.getLocalStorage(SAVE_TAG.PV_PLAYED);

        if(palyed != true){
            this.videoManager.play(null, () => {
                localStorageMgr.setLocalStorage(SAVE_TAG.PV_PLAYED, true);
                guiManager.loadScene('LoginScene');
            });
            return;
        }

        guiManager.loadScene('LoginScene');
    }

    private _initGlobalTouchGfx() {
        // ??????????????????
        this.node.on(cc.Node.EventType.TOUCH_START, this._onTouchStart, this, true);
        // @ts-ignore
        if (this.node._touchListener && this.node._touchListener.setSwallowTouches) {
            // @ts-ignore
            this.node._touchListener.setSwallowTouches(false);
        } else {
            this.node.off(cc.Node.EventType.TOUCH_START);
        }
    }

    private _onTouchStart(event: cc.Event.EventTouch) {
        this._playTouchGfx(cc.v3(this.node.convertToNodeSpaceAR(event.getLocation())));
        this.videoManager.manualClicked = true;
    }

    private _playTouchGfx(pos: cc.Vec3) {
        if(!cc.isValid(this._gfxNode)){
            const node = new cc.Node();
            const skeletonRet = node.addComponent(sp.Skeleton);
            skeletonRet.skeletonData = this.touchSkeleton;
            this.node.addChild(node);
            node.position = pos;
            this._gfxNode = node;
            skeletonRet.setCompleteListener(() => {
                this._gfxNode.getComponent(sp.Skeleton).clearTracks();
                this._gfxNode.active = false;
            });
            skeletonRet.setAnimation(0, 'animation', false);
            return;
        }

        this._gfxNode.getComponent(sp.Skeleton).clearTracks();
        this._gfxNode.active = true;
        this._gfxNode.position = pos;
        this._gfxNode.getComponent(sp.Skeleton).setAnimation(0, 'animation', false);
    }
    
    private _playCapabilityChange(eventId: number, preNum: number, endNum: number) {
        // todo ???????????????????????????????????????
        guiManager.showTips(`????????????${preNum}?????????${endNum}`);
    }

    private _showAntiAddiction(eventId: number) {
        this.antiAddiction.show();
    }

    // ?????????????????????????????????????????????
    private _showAntiAddictionTimeOut(eventId: number) {
        this._onCheckoutAccount();
        guiManager.loadView("AntiAddictionView",this.node, AntiAdditionCode.NON_ADULT_TIMEOUT, ()=> {
            //@ts-ignore
            if (isAndroid()) {
                // logout ??????????????????window.NotifyLogout()
                PackageUtils.logout();
            // @ts-ignore
            } else if (window.NotifyLogout) {
                //@ts-ignore
                window.NotifyLogout();
            } else {
                // ????????????
                cc.game.end()
            }
        })
    }

    private _showGlobalTips (cmd: any, tips: string) {
        if (tips) {
            guiManager.showTips(`${tips}`);
        }
    }

    private _showTaskTips(cmd: any, taskId: number[]) {
        if (taskId && taskId.length) {
            taskId.forEach(_tId=>{
                let cfg = configManager.getConfigByKey("task", _tId);
                guiManager.showTaskTips(`???${cfg.TaskIntroduce}??????????????????`);
            })
        }
    }

    private _mainScheduleCallFunc(){
        let now = new Date(serverTime.currServerTime() * 1000);
        let h = now.getHours(),
            m = now.getMinutes(),
            s = now.getSeconds();
        if (h==0 && m==0 && s==0){
            modelManager.onDayReset();
            eventCenter.fire(commonEvent.TIME_DAY_RESET);
            const day = now.getDay();
            if(day == 1) {
                // ?????????????????????
                modelManager.onWeekReset();
                eventCenter.fire(commonEvent.TIME_WEEK_RESET);
            }
        }
    }

    private _onCheckoutAccount(){
        FunctionGuideManager.getIns().clear();
        modelManager.deInit();
        // ??????????????????????????????
        guiManager.hideTaskTips();
    }
    private _onSvrErrorResponse(cmd: any, desc: string){
       if (desc) {
           guiManager.showTips(desc);
       }
    }

    // @ts-ignore
    // ????????????????????????skd?????????????????????????????????cc.game.EVENT_SHOW?????????????????????sdk?????????????????????c.game.EVENT_SHOW???????????????????????????
    private _onGameResume() {        
        eventCenter.fire(commonEvent.GAME_RESUME);
        if (operationSvr.disconnected) {
            operationSvr.reconnect()
        }
    }

    onDestroy() {
        this.deInit();
        this.unschedule(this._mainScheduleCallFunc);
    }
}
