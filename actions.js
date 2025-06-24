const { getPresets, connectPreset, getSelectedPreset } = require("./api")


module.exports = function (self) {
	self.setActionDefinitions({
		refresh_presets: {
			name: 'Refresh Presets',
			callback: async (event) => {
				let presets = await getPresets(self)
				if(presets===-1){
					return;
				}
				self.config.presets = JSON.stringify(presets);
				self.saveConfig(self.config);
				self.updateActions();
				self.updateFeedbacks();
			}
		},
		change_preset: {
			name: 'Change Preset',
			options: [
				{
					id: "preset",
					label: "Preset",
					type: "dropdown",
					choices: JSON.parse(self.config.presets),
					default: JSON.parse(self.config.presets)[0].id
				}
			],
			learn: async (action) => {
				let presets = await getPresets(self)
				if (presets===-1)
				{
					return;
				}
				self.config.presets = JSON.stringify(presets);
				self.saveConfig(self.config);
				self.updateActions();
				self.updateFeedbacks();
			},
			callback: async (action) => {
				let connected = await connectPreset(self, action.options.preset, action.controlId);
				Object.keys(self.presetStatus).forEach(v => self.presetStatus[v] = "disconnected")
				if (connected){
					self.presetStatus[action.options.preset] = "connected";
					self.selected = [action.options.preset]
					self.selectedPreset = action.options.preset;
				}
				//console.log(self.presetStatus[action.controlId])
				self.saveConfig(self.config);
				self.checkFeedbacks("presetStatus", "presetStatusBool", "videoStatusBool");
			},
			subscribe: async (action) => {
				const preset = action.options.preset;
				//let selected = await getSelectedPreset(self);
				self.presetStatus[preset] = self.selectedPreset === preset ? "connected":"disconnected"
				if(self.presetStatus[preset] === "connected"){
					self.selected.push(preset);
				}
				self.saveConfig(self.config);
				self.checkFeedbacks("presetStatus", "presetStatusBool", "videoStatusBool");

			},
			unsubscribe: async (action) => {
				delete self.presetStatus[action.options.preset]
				self.saveConfig(self.config);
			}
		},
		disconnect: {
			name: 'Disconnect',
			options: [
			],
			callback: async (action) => {
				await connectPreset(self, 0);
				self.presetStatus[action.options.preset]= "disconnected";
				self.selected = [];
				self.selectedPreset = 0;
				self.saveConfig(self.config);
				self.checkFeedbacks("presetStatus", "presetStatusBool", "videoStatusBool");
			}
		}
	});
}
