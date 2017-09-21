// ExtensionFrontEnd -- begin
var ExtensionFrontEnd = function()
{
	this.injectedTabs = {};
	this.frequencyData = new Uint8Array(OV.fftSize);
	this.onPortMessage = this.onPortMessage.bind(this);
};
ExtensionFrontEnd.prototype.togglePauseTab = function(tabId)
{
	if(tabId in this.injectedTabs && this.injectedTabs[tabId].injected==true)
	{
		console.log("toggling pause on tabid: "+tabId);
		chrome.tabs.executeScript(tabId, { code: "togglePause();" });
	}
	else
		console.log("trying to toggle pause on uninjected tab with id: "+tabId);
},
ExtensionFrontEnd.prototype.MainClickedCallback = function(tab)
{
	console.log("MainKey triggered on tabid: "+tab.id);
    chrome.tabs.executeScript(tab.id,
		{code: jsInjectedQuery},
		function()
		{
			if(wasError("initTab"))
				return;
			if(!(tab.id in this.injectedTabs))
				this.injectedTabs[tab.id] = new TabInfo();
			if(this.injectedTabs[tab.id].injected==false)
			{
				var scriptInjector = new ScriptInjector(tab.id);
				scriptInjector.injectScripts(AV.scriptsToInject,
					function()
					{
						this.injectedTabs[tab.id].injected = true;
						chrome.tabCapture.capture({audio: true},
							function(stream)
							{
								this.initTab(stream, tab.id);
							}.bind(this)
						);
					}.bind(this)
				);
			}
			else
				this.togglePauseTab(tab.id);
		}.bind(this)
	);
},
ExtensionFrontEnd.prototype.initTab = function(stream, tabId)
{
	if(!stream)
		wasError("initTab");
	else
		this.initAudio(stream, tabId);
	this.connectToTab(tabId);
	console.log("init() on tabId:" + tabId);
	chrome.tabs.executeScript(tabId, { code: "init();" });
},
ExtensionFrontEnd.prototype.messageHandler = function(req, sender, sendResponse)
{
    if ("tab" in sender)
	{
		if(!(sender.tab.id in this.injectedTabs))
			this.injectedTabs[sender.tab.id] = new TabInfo();
		if(req.loaded === false)
			this.injectedTabs[sender.tab.id].injected=false;
		else
			this.injectedTabs[sender.tab.id].injected=true;
		console.log("got reply from tab with id: "+sender.tab.id+", injected status: "+
			this.injectedTabs[sender.tab.id].injected);
	}
},
ExtensionFrontEnd.prototype.updateHandler = function(tabId, changeinfo, tab)
{
    chrome.tabs.executeScript(tabId, {
        code: jsInjectedQuery
	},
	function()
	{
		wasError("updateHandler");
	});
},
ExtensionFrontEnd.prototype.onPortMessage = function(msg, port)
{
	switch(msg)
	{
		case AV.music:
			this.injectedTabs[port.name].analyzer.getByteFrequencyData(this.frequencyData);
			this.injectedTabs[port.name].port.postMessage(this.frequencyData);
			return;
		case AV.openOptions:
			openOptions();
			return;
		case AV.setFullScreen:
			toggleScreenState("fullscreen");
			return;
		case AV.disableFullScreen:
			toggleScreenState();
			return;
	}
	if(msg[0] === AV.latencyHint){
		storage.options.init(window.OV, function(){
			var tabs = Object.keys(this.injectedTabs);//reinitialize on all tabs
			for(var i = 0; i<tabs.length; i++){
				this.initAudio(this.injectedTabs[tabs[i]].stream, tabs[i]);
			}
		}.bind(this), true);
	}
},
ExtensionFrontEnd.prototype.closeContext = function(id){
	return this.injectedTabs[id].context.close().then(function(){
		delete this.injectedTabs[id].context;
	}.bind(this));
}
ExtensionFrontEnd.prototype.initAudio = function(stream, id)
{
	if(this.injectedTabs[id].context){
		this.injectedTabs[id].sourceNode.disconnect();
		this.closeContext(id).then(function(){
			this.initAudio(stream, id);
		}.bind(this));
		return;
	}
	var audioCtxSettings = {latencyHint: OV.LatencyHint};
	console.log(audioCtxSettings);
	this.injectedTabs[id].context = new AudioContext(audioCtxSettings);
	this.injectedTabs[id].sourceNode = this.injectedTabs[id].context.createMediaStreamSource(stream);
	this.injectedTabs[id].analyzer = this.injectedTabs[id].context.createAnalyser();
	this.injectedTabs[id].analyzer.fftSize = OV.fftSize;
	this.injectedTabs[id].sourceNode.connect(this.injectedTabs[id].analyzer);
	this.injectedTabs[id].sourceNode.connect(this.injectedTabs[id].context.destination);
	this.injectedTabs[id].stream = stream;
},
ExtensionFrontEnd.prototype.connectToTab = function(id)
{
	console.log("connecting 2 tab: " + id);
	this.injectedTabs[id].port = chrome.tabs.connect(id);
	this.injectedTabs[id].port.name = id;
	this.injectedTabs[id].port.onMessage.addListener(this.onPortMessage);
},
// ExtensionFrontEnd -- end


// ScriptInjector  -- begin
ScriptInjector = function(tabId)
{
	this.tabId = tabId;
	this.scriptsLoadedCallback = null;
};
ScriptInjector.prototype.injectScripts = function(scripts, callback)
{
	this.scriptsLoadedCallback = callback;
	this.scripts = scripts;
	this.scriptsLoaded = 0;
	for(var script of scripts)
		chrome.tabs.executeScript(this.tabId, {file:script}, this.scriptInjectCount.bind(this));
},
ScriptInjector.prototype.scriptInjectCount=function()
{
	if(++this.scriptsLoaded == this.scripts.length)
	{
		this.scriptsLoadedCallback();
	}
},
// ScriptInjector  -- end

// TabInfo - date struct class
TabInfo = function()
{
	this.port = null;
	this.id = null;
	this.injected = false;
	this.analyzer = null;
},

// errorHandling
wasError = function(id)
{
	return	chrome.runtime.lastError ?
			console.log(	"error from id: " + id + "\n" +
							"message: "+ chrome.runtime.lastError.message)
			||true
			:false;
},
jsInjectedQuery = "chrome.extension.sendMessage({ loaded: typeof window.g !== 'undefined'});";
