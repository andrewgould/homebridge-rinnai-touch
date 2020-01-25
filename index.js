var request = require("request");

var Characteristic,
	Service;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	Accessory = homebridge.hap.Accessory;

	homebridge.registerAccessory("homebridge-rinnai-touch", "RinnaiTouch", RinnaiTouch);
};

function RinnaiTouch(log, config) {
	this.log = log;
	this.name = config["name"];
	this.ip = config['ip'];
	this.debug = config["debug"] || false;
	this.token = null;
	this.device = null;
	this.version = "1.0.0";

	this.values = [];
	this.values.Active = Characteristic.Active.INACTIVE;
	this.values.CurrentTemperature = null;
	this.values.ThresholdTemperature = null;
	this.values.RotationSpeed = 0;
}

RinnaiTouch.prototype = {

	identify: function(callback) {
		this.log("identify");
		callback();
	},

	getServices: function() {
		this.hcService = new Service.HeaterCooler(this.name);

		this.hcService
			.getCharacteristic(Characteristic.Active)
			.on('get', this._getValue.bind(this, "Active"))
			.on('set', this._setValue.bind(this, "Active"));

		this.hcService
			.getCharacteristic(Characteristic.TargetTemperature)
			.setProps({
				minValue: 16,
				maxValue: 30,
				minStep: 1
			})
			.on('get', this._getValue.bind(this, "ThresholdTemperature"))
			.on('set', this._setValue.bind(this, "ThresholdTemperature"));

		this.hcService
			.getCharacteristic(Characteristic.HeatingThresholdTemperature)
			.setProps({
				minValue: 16,
				maxValue: 30,
				minStep: 1
			})
			.on('set', this._setValue.bind(this, "ThresholdTemperature"));

		this.hcService
			.getCharacteristic(Characteristic.CoolingThresholdTemperature)
			.setProps({
				minValue: 8,
				maxValue: 30,
				minStep: 1
			})
			.on('set', this._setValue.bind(this, "ThresholdTemperature"));

		this.hcService
			.getCharacteristic(Characteristic.TargetHeaterCoolerState)
			.on('set', this._setValue.bind(this, "TargetHeaterCoolerState"));

		this.informationService = new Service.AccessoryInformation();
		this.informationService
			.setCharacteristic(Characteristic.Name, this.name)
			.setCharacteristic(Characteristic.Manufacturer, "Rinnai")
			.setCharacteristic(Characteristic.Model, "N-BW2")
			.setCharacteristic(Characteristic.FirmwareRevision, this.version)
			.setCharacteristic(Characteristic.SerialNumber, this.device);

		return [
			this.informationService,
			this.hcService
		];
	},

	_getValue: function(CharacteristicName, callback) {
		if(this.debug) {this.log("GET", CharacteristicName);}
		
		const spawn = require("child_process").spawn;
		const pythonProcess = spawn('python',["node_modules/rinnai-touch-python-interface/rinnai-touch-status.py", this.ip]);
		
		pythonProcess.stdout.on('data', (dataRaw) => {
			// {"Status": { "System": { "EvapMode":false,"HeaterMode":false,"SystemOn": true },"Heater": { "HeaterOn":false,"FanSpeed": 0,"CirculationFanOn": false,"AutoMode": false,"ManualMode": false,"SetTemp": 0,"ZoneA": false,"ZoneB": false,"ZoneC": false,"ZoneD": false},"Cooling": { "CoolingOn":true,"CirculationFanOn": true,"AutoMode": false,"ManualMode": true,"SetTemp": 20,"ZoneA": true,"ZoneB": false,"ZoneC": false,"ZoneD": false},"Evap": { "EvapOn":false,"FanOn": false,"FanSpeed": 0,"WaterPumpOn": false}}}

			const data = JSON.parse(dataRaw);
			
			this.hcService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(0);

			switch (data.System.CurrentMode) {
				case 'COOLING':
					this.hcService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.COOLING);
					this.hcService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.COOLING);
					this.hcService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.COOL);
					
					this.values.CurrentTemperature = data.Cooling.SetTemp;
					this.hcService.getCharacteristic(Characteristic.ThresholdTemperature).updateValue(this.values.CurrentTemperature);
					this.hcService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.values.CurrentTemperature);
					break;
				
				case 'HEATING':
					this.hcService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.HEATING);
					this.hcService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.HEATING);
					this.hcService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.HEAT);
					
					this.values.CurrentTemperature = data.Heating.SetTemp;
					this.hcService.getCharacteristic(Characteristic.ThresholdTemperature).updateValue(this.values.CurrentTemperature);
					this.hcService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.values.CurrentTemperature);
					break;
				
				default:
					this.hcService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.INACTIVE);
					this.hcService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.OFF);
			}
		});
	},

	_setValue: function(CharacteristicName, value, callback) {
		if(this.debug) {this.log("SET", CharacteristicName, value);}

		var parameters = [];

		switch (CharacteristicName) {
			case "Active":
				switch (value) {
					case Characteristic.Active.ACTIVE:
						parameters.push('--action=on');
					break;

					default:
						parameters.push('--action=off')
					break;
				}
			break;

			case "TargetHeaterCoolerState":
				// The Panasonic API responses don't line up with what we expect
				switch (value) {
					case Characteristic.TargetHeaterCoolerState.COOL:
						parameters.push('--mode=cool');
						this.hcService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(3);
					break;

					case Characteristic.TargetHeaterCoolerState.HEAT:
						parameters.push('--mode=heat')
						this.hcService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(2);
					break;
				}
			break;

			case "ThresholdTemperature":
				parameters.push('--heatTemp=' + value);
				parameters.push('--coolTemp=' + value);
			break;
		}
		
		const spawn = require("child_process").spawn;
		const pythonProcess = spawn('python',["node_modules/rinnai-touch-python-interface/rinnai-touch-client.py", this.ip, ...parameters]);
	}

};
