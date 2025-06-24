const { combineRgb } = require('@companion-module/base')

module.exports = async function (self) {
	self.setFeedbackDefinitions({
		presetStatus: {
			name: 'Preset Connection Status - Advanced (Companion Only)',
			label: 'Preset Status',
			type: 'advanced',
				options: [
					{
						type: 'dropdown',
						label: 'Preset',
						id: 'preset',
						tooltip: 'Preset to track connection status.',
						choices: JSON.parse(self.config.presets),
						default: JSON.parse(self.config.presets)[0].id
					},
					{
						type: 'colorpicker',
						label: 'Connected Background Color',
						id: 'bg_connected',
						tooltip: 'Button Background Color for successful connection',
						default: 0x00ff00 // Green
					},
					{
						type: 'colorpicker',
						label: 'Connected Text Color',
						id: 'fg_connected',
						tooltip: 'Button Text color for successful connection',
						default: 0x000000 // Black
					},
					{
						type: 'colorpicker',
						label: 'Disconnected Background Color',
						id: 'bg_error',
						tooltip: 'Button Background Color for failed connection',
						default: 0xff0000 // Red
					},
					{
						type: 'colorpicker',
						label: 'Disconnected Text Color',
						id: 'fg_error',
						tooltip: 'Button Background Color for failed connection',
						default: 0xffffff // White
					},
				],
			callback: (feedback) => {
				let connectionStatus = self.presetStatus?.[feedback.options.preset] || {};
				
				if (connectionStatus === "connected"){
					return {
						bgcolor: feedback.options.bg_connected,
						color: feedback.options.fg_connected,
					}
				}else if (connectionStatus === "connecting"){
					return {
							bgcolor: feedback.options.bg_warning,
							color: feedback.options.fg_warning,
							text: "Connecting"
						}
				}else{
					return {
						bgcolor: feedback.options.bg_error, 
						color: feedback.options.fg_error 
					}					
				}

			},
		},
		presetStatusBool: {
			name: 'Preset Status - Boolean',
			label: 'Preset Status - Boolean',
			type: 'boolean',
			options: [
				{
					type: 'dropdown',
					label: 'Preset',
					id: 'preset',
					tooltip: 'Preset to track connection status.',
					choices: JSON.parse(self.config.presets),
					default: JSON.parse(self.config.presets)[0].id
				},
			],
			callback: (feedback) => {
			let connectionStatus = self.presetStatus?.[feedback.options.preset] || {};
				
				if (connectionStatus === "connected"){
					return true;
				}else{
					return false;
				}
			}
		},
	})
}
