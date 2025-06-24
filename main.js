const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const { getPresets, getSelectedPreset, checkReceiver } = require("./api")


class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.config = config
		this.currentStatus = InstanceStatus.Connecting;

		if(!this.config.presets){
			this.config.presets = JSON.stringify([{ id: "None", label: "None" }]);
		}
		this.presetStatus={}
		this.selected=[];
		this.conCounter=0;
		this.connected = await this.checkConnection();
		if (this.connected){
			const selected= await getSelectedPreset(this, 1, 1);
			if (selected !== -1 && this.selectedPreset != selected){
				this.selectedPreset = selected;
				this.checkFeedbacks("presetStatus", "presetStatusBool", "videoStatusBool");
			}
		}
		this.saveConfig(this.config);
		
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
		this.startConnectionMonitor();
	}
	// When module gets deleted
	async destroy() {
		this.stopConnectionMonitor();
		if (this.openTimeout) {
			clearTimeout(this.openTimeout);
			this.openTimeout = null;
		}
		this.log('debug', 'destroy')
	}

	async checkConnection() {
		if (this.config.host === undefined || this.config.host === ""){
			return;
		}
		if (this.isChecking) {
			this.log('debug', 'Skipping duplicate connection check...');
			return;
		}
		this.isChecking = true;
		try {
			let success = true;
			try {
				await checkReceiver(this);
				success = true;
			} catch (error) {
				success = false;
			}

			if (!success) {
				this.log("error", "Could not connect to Receiver, Please Check IP Address.");
				if (this.currentStatus !== InstanceStatus.ConnectionFailure){
					this.currentStatus=InstanceStatus.ConnectionFailure;
					this.updateStatus(InstanceStatus.ConnectionFailure, "Failed to connect to receiver.");
				}
				return false;
			} else {

				this.conCounter = (this.conCounter + 1) % 2;
				if (this.currentStatus !== InstanceStatus.Ok){
					this.currentStatus=InstanceStatus.Ok;
					this.updateStatus(InstanceStatus.Ok, "Connected to Receiver.");
				}

				return true;
			}
		} finally {
			this.isChecking = false; 
		}
	}


	startConnectionMonitor() {
		// Clear any previous monitor interval
		if (this.connectionMonitor) {
			clearInterval(this.connectionMonitor);
		}

		this.connectionMonitor = setInterval(async () => {
			this.connected = await this.checkConnection(); 
			if (this.connected && this.conCounter == 0){
				const presets = await getPresets(this);
				if (presets !== -1 && this.config.presets !== JSON.stringify(presets)){
					this.config.presets = JSON.stringify(presets);
					this.updateActions();
					this.updateFeedbacks();
				}
			}else{
					const selected= await getSelectedPreset(this, 1, 1);
					if (selected !== -1 && this.selectedPreset != selected){
						this.selectedPreset = selected;
						this.checkFeedbacks("presetStatus", "presetStatusBool", "videoStatusBool");
					}
				}
			this.conCounter = (this.conCounter + 1) % 2;
			
		}, 10000);  // Every 10 seconds
	}

	stopConnectionMonitor() {
		if (this.connectionMonitor) {
			clearInterval(this.connectionMonitor);
			this.connectionMonitor = null;
		}
	}


	async configUpdated(config) {
		this.config = config
		this.connected = await this.checkConnection();
	}


	// Return config fields for web config
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Receiver IP',
				width: 8,
				regex: Regex.IP,
				default: ""
			},
			{
				type: 'textinput',
				id: 'password',
				label: 'Password',
				width: 8,
				default: ""
			},
		]
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
