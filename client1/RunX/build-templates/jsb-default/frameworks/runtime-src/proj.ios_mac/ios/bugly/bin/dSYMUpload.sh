#!/bin/sh
#
# Copyright 2016 Bugly, Tencent. All rights reserved.
#
# V1.4.0
#
# 2016.08.03
#
#
#
######################################################
# 1. 脚本集成到Xcode工程的Target
######################################################
#
# --- Copy the SCRIPT to the Run Script of Build Phases in the Xcode project ---
#
# #
BUGLY_APP_ID="5d4044faa6"
# #
BUGLY_APP_KEY="b5e3c67c-0de0-4e19-a970-cc6d1a2d058a"
# #
BUNDLE_IDENTIFIER="com.zqgame.RunX"
# #
UPLOAD_DSYM_ONLY=1
#
# # 脚本默认配置的版本格式为CFBundleShortVersionString(CFBundleVersion),  如果你修改默认的版本格式, 请设置此变量, 如果不想修改, 请忽略此设置
# CUSTOMIZED_APP_VERSION=""
#
# # Debug模式编译是否上传，1＝上传 0＝不上传，默认不上传
# UPLOAD_DEBUG_SYMBOLS=0
#
# # 模拟器编译是否上传，1=上传 0=不上传，默认不上传
# UPLOAD_SIMULATOR_SYMBOLS=0
#
# #只有Archive操作时上传, 1=支持Archive上传 0=所有Release模式编译都上传
# UPLOAD_ARCHIVE_ONLY=0
#
# #
# source dSYMUpload.sh
#
# --- END OF SCRIPT ---
#
#
#
#
#######################################################
# 2. 脚本根据输入参数处理
#######################################################
#
# #命令行下输入应用基本信息, .dSYM文件的父目录路径, 输出文件目录即可
#
# sh dSYMUpload.sh <bugly_app_id> <bugly_app_key> <app_bundle_identifier> <app_version> <dSYM_src_dir> <bSYMBOL_dest_dir>
#
# #
#
# #注意:
# # 1. dSYMUpload.sh会调用buglySymboliOS.jar进行.dSYM解析，所以依赖Java运行时环境
# # 2. dSYMUpload.sh和buglySymboliOS.jar的文件路径需一致
#
# # 3. 2021-7-28 dex@Zqgame 只支持在xcode工程中执行，其他环境没测过

#
# --- CONTENT OF SCRIPT ---
#

# Bugly服务域名
BUGLY_DSYM_UPLOAD_DOMAIN="api.bugly.qq.com"

# 注意jar工具的路径跟dSYMUpload.sh脚本路径一致, 请务必保证jar路径的正确性
BUGLY_SYMBOL_JAR_PATH="ios/bugly/bin/buglyqq-upload-symbol.jar"
# 查找添加到系统目录的jar工具
if [ ! -f "${BUGLY_SYMBOL_JAR_PATH}" ]; then
    BUGLY_SYMBOL_JAR_PATH="$SRCROOT/bugly/bin/buglyqq-upload-symbol.jar"
fi

# 打印错误信息
function exitWithMessage(){
    echo "--------------------------------"
    echo "${1}"
    echo "--------------------------------"
    exit ${2}
}

# 上传bSYMBOL文件
function dSYMUpload() {
    P_APP_ID="$1"
    P_APP_KEY="$2"
    P_APP_BUNDLE_ID="$3"
    P_APP_VERSION="$4"
    P_BSYMBOL_FILE_PATH="$5"

    echo "----------- start to upload dsym file ------------------"
    (/usr/bin/java -Xms512m -Xmx1024m -Dfile.encoding=UTF8 -jar "${BUGLY_SYMBOL_JAR_PATH}" -appid "${P_APP_ID}" -appkey "${P_APP_KEY}" -bundleid "${P_APP_BUNDLE_ID}" -version "${BUGLY_APP_VERSION}" -platform "IOS" -inputSymbol "${P_BSYMBOL_FILE_PATH}" )
    echo "-----------------------------"
}

# .dSYM解析为bSYMBOL文件
function dSYMParse() {
    DSYM_FILE="$1"
    DSYM_SYMBOL_FILE="$2"

    echo "--------------------------------"
    echo "Extract symbol info from .dSYM file. to ${DSYM_SYMBOL_FILE}"
    (/usr/bin/java -Xms512m -Xmx1024m -Dfile.encoding=UTF8 -jar "${BUGLY_SYMBOL_JAR_PATH}" -i "${DSYM_FILE}" -o "${DSYM_SYMBOL_FILE}" ) || exitWithMessage "Error: Failed to extract symbols." 1
    echo "--------------------------------"

}

function checkCompressedSourceFile() {
    SDYM_SIGLE_FILE_IS_EXIST=1
    for i in {1..10}; do
        sleep 1s
        # 遍历目录查找当前工程名的文件
        for dsymSingleFile in $(find "${dsymFile}" -name ${PRODUCT_NAME}); do
            if [ -s "${dsymSingleFile}" ];then
                # 压缩文件存在
                SDYM_SIGLE_FILE_IS_EXIST=0
                return $SDYM_SIGLE_FILE_IS_EXIST
            fi
        done
    done
    return $SDYM_SIGLE_FILE_IS_EXIST
}

# 执行
function run() {

    CONFIG_BUGLY_APP_ID="$1"
    CONFIG_BUGLY_APP_KEY="$2"

    CONFIG_BUGLY_APP_BUNDLE_IDENTIFIER="$3"
    CONFIG_BUGLY_APP_VERSION="$4"
    CONFIG_DSYM_SOURCE_DIR="$5"
    CONFIG_DSYM_DEST_DIR="$6"
    CONFIG_UPLOAD_DSYM_ONLY="$7"

    # 检查必须参数是否设置
    if [ ! "${CONFIG_BUGLY_APP_ID}" ]; then
        exitWithMessage "Error: Bugly App ID not defined. Please set 'BUGLY_APP_ID' " 0
    fi

    if [[ "${CONFIG_BUGLY_APP_ID}" == *"App ID"* ]]; then
        exitWithMessage "Error: Bugly App ID not defined." 0
    fi

    if [ ! "${CONFIG_BUGLY_APP_KEY}" ]; then
        exitWithMessage "Error: Bugly App Key not defined." 0
    fi

    if [ ! "${CONFIG_BUGLY_APP_BUNDLE_IDENTIFIER}" ]; then
        exitWithMessage "Error: Bundle Identifier not defined." 0
    fi

    if [ ! "${CONFIG_BUGLY_APP_VERSION}" ]; then
        exitWithMessage "Error: App Version not defined." 0
    fi

    if [ ! -e "${CONFIG_DSYM_SOURCE_DIR}" ]; then
        exitWithMessage "Error: Invalid dir ${CONFIG_DSYM_SOURCE_DIR}" 0
    fi

    if [ ! "${CONFIG_DSYM_DEST_DIR}" ]; then
        exitWithMessage "Error: Invalid dir ${CONFIG_DSYM_DEST_DIR}" 0
    fi

    if [ ! -e "${CONFIG_DSYM_DEST_DIR}" ]; then
        mkdir ${CONFIG_DSYM_DEST_DIR}
    fi

    DSYM_FOLDER="${CONFIG_DSYM_SOURCE_DIR}"
    IFS=$'\n'

    echo "Scaning dSYM FOLDER: ${DSYM_FOLDER} ..."
    RET="F"
    
    #
    for dsymFile in $(find "$DSYM_FOLDER" -name '*.dSYM'); do
        RET="T"
        echo "Found dSYM file: $dsymFile"
        
        # 上传
        dSYMUpload $CONFIG_BUGLY_APP_ID $CONFIG_BUGLY_APP_KEY $CONFIG_BUGLY_APP_BUNDLE_IDENTIFIER $CONFIG_BUGLY_APP_BUNDLE_IDENTIFIER $CONFIG_DSYM_DEST_DIR
    done

    if [ $RET = "F" ]; then
        exitWithMessage "No .dSYM found in ${DSYM_FOLDER}" 0
    fi
}

# 在Xcode工程中执行
function runInXcode(){
    echo "Uploading dSYM to Bugly in Xcode ..."

    echo "Info.Plist : ${INFOPLIST_FILE}"

    BUNDLE_VERSION=$(/usr/libexec/PlistBuddy -c 'Print CFBundleVersion' "${INFOPLIST_FILE}")
    BUNDLE_SHORT_VERSION=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "${INFOPLIST_FILE}")

    # 组装Bugly默认识别的版本信息(格式为CFBundleShortVersionString(CFBundleVersion), 例如: 1.0(1))
    if [ ! "${CUSTOMIZED_APP_VERSION}" ]; then
        BUGLY_APP_VERSION="${BUNDLE_SHORT_VERSION}(${BUNDLE_VERSION})"
    else
        BUGLY_APP_VERSION="${CUSTOMIZED_APP_VERSION}"
    fi

    echo "--------------------------------"
    echo "Prepare application information."
    echo "--------------------------------"

    echo "Product Name: ${PRODUCT_NAME}"
    echo "Bundle Identifier: ${BUNDLE_IDENTIFIER}"
    echo "Version: ${BUNDLE_SHORT_VERSION}"
    echo "Build: ${BUNDLE_VERSION}"

    echo "Bugly App ID: ${BUGLY_APP_ID}"
    echo "Bugly App key: ${BUGLY_APP_KEY}"
    echo "Bugly App Version: ${BUGLY_APP_VERSION}"

    echo "--------------------------------"
    echo "Check the arguments ..."

    ##检查模拟器编译是否允许上传符号
    if [ "$EFFECTIVE_PLATFORM_NAME" == "-iphonesimulator" ]; then
    if [ $UPLOAD_SIMULATOR_SYMBOLS -eq 0 ]; then
        exitWithMessage "Warning: Build for simulator and skipping to upload. \nYou can modify 'UPLOAD_SIMULATOR_SYMBOLS' to 1 in the script." 0
    fi
    fi

    ##检查是否是Release模式编译
    if [ "${CONFIGURATION=}" == "Debug" ]; then
    if [ $UPLOAD_DEBUG_SYMBOLS -eq 0 ]; then
        exitWithMessage "Warning: Build for debug mode and skipping to upload. \nYou can modify 'UPLOAD_DEBUG_SYMBOLS' to 1 in the script." 0
    fi
    fi

    ##检查是否Archive操作
    if [ $UPLOAD_ARCHIVE_ONLY -eq 1 ]; then
    if [[ "$TARGET_BUILD_DIR" == *"/Archive"* ]]; then
        echo "Archive the package"
    else
        exitWithMessage "Warning: Build for NOT Archive mode and skipping to upload. \nYou can modify 'UPLOAD_ARCHIVE_ONLY' to 0 in the script." 0
    fi
    fi

    #
    run ${BUGLY_APP_ID} ${BUGLY_APP_KEY} ${BUNDLE_IDENTIFIER} ${BUNDLE_VERSION} ${DWARF_DSYM_FOLDER_PATH} ${BUILD_DIR}/Release-iphoneos ${UPLOAD_DSYM_ONLY}
}

# 根据Xcode的环境变量判断是否处于Xcode环境
INFO_PLIST_FILE="${INFOPLIST_FILE}"

BuildInXcode="F"
if [ -f "${INFO_PLIST_FILE}" ]; then
    BuildInXcode="T"
fi

if [ $BuildInXcode = "T" ]; then
    runInXcode
else
    echo "\nUsage: dSYMUpload.sh <bugly_app_id> <bugly_app_key> <app_bundle_identifier> <app_version> <dSYM_src_dir> <bSYMBOL_dest_dir> [upload_dsym_only]\n"
    # 你可以在此处直接设置BuglyAppID和BuglyAppKey，排除不常变参数的输入
    BUGLY_APP_ID="$1"
    BUGLY_APP_KEY="$2"
    BUNDLE_IDENTIFIER="$3"
    BUGLY_APP_VERSION="$4"
    DWARF_DSYM_FOLDER_PATH="$5"
    SYMBOL_OUTPUT_PATH="$6"
    UPLOAD_DSYM_ONLY=$7
    run ${BUGLY_APP_ID} ${BUGLY_APP_KEY} ${BUNDLE_IDENTIFIER} ${BUGLY_APP_VERSION} ${DWARF_DSYM_FOLDER_PATH} ${SYMBOL_OUTPUT_PATH} ${UPLOAD_DSYM_ONLY}
fi
