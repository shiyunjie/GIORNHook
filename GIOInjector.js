var fs = require('fs');
var common = require('./GIOCommon')


/* 
 * filePath: ReactNative的文件夹地址
 */
function injectReactNative(dirPath, reset=false){
	if(!dirPath.endsWith('/')){
		dirPath += '/';
	}
	var touchableJsFilePath = `${dirPath}Libraries/Components/Touchable/Touchable.js`
	if(reset){
		common.resetFile(touchableJsFilePath);
	}else{
		injectOnPressScript(touchableJsFilePath);
	}
	var createViewJsFiles = ['Libraries/Renderer/src/renderers/native/ReactNativeFiber.js',
							 'Libraries/Renderer/src/renderers/native/ReactNativeFiber-dev.js',
							 'Libraries/Renderer/src/renderers/native/ReactNativeFiber-prod.js',
							 'Libraries/Renderer/src/renderers/native/ReactNativeFiber-profiling.js',
							 'Libraries/Renderer/oss/ReactNativeRenderer-dev.js',
							 'Libraries/Renderer/oss/ReactNativeRenderer-prod.js',
							 'Libraries/Renderer/oss/ReactNativeRenderer-profiling.js'];
	createViewJsFiles.forEach(function(createViewFilePath){
		var jsFile = `${dirPath}${createViewFilePath}`;
		if(fs.existsSync(jsFile)){
			if(reset){
				common.resetFile(jsFile);
			}else{
			    console.log(`hook createView for: ${jsFile}`);
				injectCreateViewScript(jsFile);
			}
		}
	});
}

function injectReactNavigation(dirPath, reset=false){
	if(!dirPath.endsWith('/')){
		dirPath += '/';
	}
	var createNavigationContainerJsFilePath = `${dirPath}src/createNavigationContainer.js`
	if(reset){
		common.resetFile(createNavigationContainerJsFilePath);
	}else{
		injectNavigationScript(createNavigationContainerJsFilePath);
	}
}

function injectNavigationScript(filePath){
	common.modifyFile(filePath, onNavigationStateChangeTransformer);
}

/**
 * filePath: 对应的JS文件地址
 */
function injectCreateViewScript(filePath){
	common.modifyFile(filePath, createViewTransformer);
}

function injectOnPressScript(filePath){
	common.modifyFile(filePath, onPressTransformer);
}

function onNavigationStateChangeTransformer(content){
	var index = content.indexOf("if (typeof this.props.onNavigationStateChange === 'function') {");
	if(index == -1)
		throw "index is -1";
	content = content.substring(0, index) + common.anonymousJsFunctionCall(navigationString('nav', 'action'))  + '\n' + content.substring(index)
	var didMountIndex = content.indexOf('componentDidMount() {');
	if(didMountIndex == -1)
		throw "didMountIndex is -1";
	var forEachIndex = content.indexOf('this._actionEventSubscribers.forEach(subscriber =>', didMountIndex);
	var clojureEnd = content.indexOf(')', forEachIndex);
	content = content.substring(0, forEachIndex) + '{' +
		common.anonymousJsFunctionCall(navigationString('this.state.nav', null)) + '\n' + 
		content.substring(forEachIndex, clojureEnd + 1) +
		'}' + content.substring(clojureEnd + 1);
	return content;
}

function navigationString(currentStateVarName, actionName){
	var script = `function $$$getActiveRoute$$$(navigationState){
	if(!navigationState)
		return null;
	const route = navigationState.routes[navigationState.index];
	if(route.routes){
		return $$$getActiveRoute$$$(route);
	}else{
		return route;
	}
}
`;
	if(actionName){
		script = `${script} if(${actionName}.type == 'Navigation/SET_PARAMS' || ${actionName}.type == 'Navigation/COMPLETE_TRANSITION'){
	return;
}
`
	}

	script = `${script} var screen = $$$getActiveRoute$$$(${currentStateVarName});
require('react-native').NativeModules.GrowingIOModule.onPageShow(screen.routeName);
`
	return script;
}

function onPressTransformer(content){
	var index = content.indexOf('this.touchableHandlePress(');
	if(index == -1)
		throw "Can't not hook onPress function";
	var injectScript = "var ReactNative = require(react-native);\n" +
		"this.props.onPress&&ReactNative.NativeModules.GrowingIOModule.onClick(ReactNative.findNodeHandle(this));"
	injectScript = common.anonymousJsFunctionCall(injectScript);
	var result = `${content.substring(0, index)}\n${injectScript}\n${content.substring(index)}`
	return result;
}

function createViewTransformer(content){
	var objRe = /UIManager\.createView\([\s\S]{1,60}\.uiViewClassName,[\s\S]*?\);/
	var match = objRe.exec(content);
	if(!match)
		throw "can't inject createView, please connect with GrowingIO";
	var lastCommaIndex = content.lastIndexOf(',', match.index);
	if(lastCommaIndex == -1)
		throw "can't inject createView,and lastCommaIndex is -1";
	var nextCommaIndex = content.indexOf(',', match.index + match[0].length);
	if(nextCommaIndex == -1)
		throw "can't inject createView, and nextCommaIndex is -1";
	var propsName = lastArgumentName(content, lastCommaIndex).trim();
	var tagName = lastArgumentName(content, nextCommaIndex).trim();
	//console.log(`propsName: ${propsName}, and tagName: ${tagName}`);
	var functionBody =
		`var clickable = false;
         var growingParams = ${propsName}.growingParams;
         if(${propsName}.onStartShouldSetResponder){
             clickable = true;
         }
         require('react-native').NativeModules.GrowingIOModule.prepareView(${tagName}, clickable, groiwngParams);
        `;
	var call = common.anonymousJsFunctionCall(functionBody);
	var result = `${content.substring(0, match.index)}\n${call}\n${content.substring(match.index)}`
	return result;
}

function lastArgumentName(content, index){
	--index;
	var lastComma = content.lastIndexOf(',', index);
	var lastParentheses = content.lastIndexOf('(', index);
	var start = Math.max(lastComma, lastParentheses);
	return content.substring(start + 1, index + 1);
}

module.exports = {
	injectCreateViewScript: injectCreateViewScript,
	createViewTransformer: createViewTransformer,
	injectOnPressScript: injectOnPressScript,
	injectNavigationScript: injectNavigationScript,
	injectReactNative: injectReactNative,
	injectReactNavigation: injectReactNavigation
}