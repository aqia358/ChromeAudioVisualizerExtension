var SceneManager = function(scenes, sceneSelector, system)
{
    this.scenes = scenes;
    this.sceneSelector = sceneSelector;
	this.currentScene = null;
};
SceneManager.prototype.init = function(system)
{
	this.system = system
    this.initCurrentScene();
};
SceneManager.prototype.savePreset = function()
{
	saveToDisk(this.currentScene);
};
SceneManager.prototype.cleanUpCurrentScene = function()
{
	if('cleanUp' in this.currentScene)
		this.currentScene.cleanUp();
}
SceneManager.prototype.initCurrentScene = function()
{
    aLog("init scene: " + this.sceneSelector.scene, 1);
	resetBrokenGlobalSceneValues();
	if(this.sceneSelector.scene in this.scenes)
	{
		this.currentScene = this.scenes[this.sceneSelector.scene];
		this.currentScene.parseSettings("default");
	}
	else
		loadFromDisk(this);
	//level with custom settings
	if('init' in this.currentScene)
		this.currentScene.init();
	aLog("setting save name for: "+this.currentScene.name, 1);
	setSaveName(this.currentScene.name);
    g.gui.refresh(this.currentScene.settings);
};
function setSaveName(sceneName, callback)
{
	if(sceneName.indexOf("_custom") === -1)
		g.saveSceneName = sceneName + "_custom";
	else
		g.saveSceneName = getIncrementalString(sceneName);

	chrome.storage.sync.get(null,
		function(savedPresets)
		{
			var occupado = false;
			for(var preset in savedPresets)
			{
				var presetName = preset.split(g.strDelim)[1];
				if(presetName == g.saveSceneName)
					occupado = true;
			}
			if(occupado)
				setSaveName(g.saveSceneName, callback);
			else
			{
				g.gui.reCheckValuesInternally();
				if(callback)
					callback();
			}
		});
}

function getIncrementalString(origStr)
{
	var lenMinOne = origStr.length-1;
	var incremStr;
	if(isNaN(origStr[lenMinOne]))
		incremStr = origStr + "0";
	else
	{
		var y = parseInt(origStr[lenMinOne])+1;
		if(y>9)
			incremStr = origStr + "0";
		else
			incremStr = origStr.substring(0, lenMinOne)+y;
	}
	return incremStr;
}
SceneManager.prototype.update = function()
{
	if(!g.pause)
	{
		window.requestAnimationFrame(this.update.bind(this));
		this.system.update(this.currentScene);
		if(this.sceneSelector.scene != this.currentScene.name)
		{
			this.cleanUpCurrentScene();
			this.initCurrentScene();
		}
	}
	else
		aLog("scene paused");
};
function saveToDisk(scene)
{
	var sceneName = scene.originalName + g.strDelim + g.saveSceneName;
	aLog("saving as :" + sceneName, 1);
	var pkg = {};
	pkg[sceneName] = scene.settings;
	//chrome.storage.sync.clear();
	chrome.storage.sync.set(pkg,
		function() {
			aLog('Settings saved', 1);
			aLog(chrome.runtime.lastError, 1);
			chrome.storage.sync.get(null,
					g.sceneSelector.insertPresets.bind(g.sceneSelector));
		}
	);
}
function loadFromDisk(scMgr)
{
	var sceneName, preset;
	aLog("trying to find: "+g.sceneSelector.scene+" in: ", 1);
	aLog(g.presets.valueOf(), 1);
	for(var i in g.presets)
	{
		var parts = i.split(g.strDelim);
		if(parts[1] == g.sceneSelector.scene)
		{
			aLog("found:",1);
			aLog(i,1);
			preset = g.presets[i];
			sceneName = parts[0];
		}
	}
	aLog("loading custom settings for sceneName: "+sceneName, 1);
	scMgr.currentScene = scMgr.scenes[sceneName];
	scMgr.currentScene.parseSettings(preset);
	scMgr.currentScene.name = g.sceneSelector.scene;
}