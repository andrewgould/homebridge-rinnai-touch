var request = require('request');
const {exec} = require('child_process');

var Characteristic, Service;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Accessory = homebridge.hap.Accessory;

  homebridge.registerAccessory(
    'homebridge-rinnai-touch',
    'RinnaiTouch',
    RinnaiTouch,
  );
};

function RinnaiTouch(log, config) {
  this.log = log;
  this.name = config['name'];
  this.ip = config['ip'];
  this.debug = config['debug'] || false;
  this.token = null;
  this.device = null;
  this.version = '1.0.0';

  this.apiOutput = {
    System: {
      CoolingMode: true,
      CurrentMode: 'COOLING',
      EvapMode: false,
      HeaterMode: false,
      SystemOn: false,
      TestData: true,
    },
    Heater: {
      HeaterOn: false,
      FanSpeed: 0,
      CirculationFanOn: false,
      AutoMode: false,
      ManualMode: false,
      SetTemp: 0,
      ZoneA: false,
      ZoneB: false,
      ZoneC: false,
      ZoneD: false,
    },
    Cooling: {
      CoolingOn: false,
      CirculationFanOn: false,
      AutoMode: false,
      ManualMode: false,
      SetTemp: 22,
      ZoneA: false,
      ZoneB: false,
      ZoneC: false,
      ZoneD: false,
    },
    Evap: {EvapOn: false, FanOn: false, FanSpeed: 0, WaterPumpOn: false},
  };

  this.refreshData();
  setInterval(this.refreshData, 5000);

  this.values = [];
  this.values.Active = this.apiOutput.System.SystemOn
    ? Characteristic.Active.ACTIVE
    : Characteristic.Active.INACTIVE;
  this.values.CurrentTemperature = this.apiOutput.System.CoolingMode
    ? this.apiOutput.Cooling.SetTemp
    : this.apiOutput.Heater.SetTemp;
  this.values.ThresholdTemperature = this.apiOutput.System.CoolingMode
    ? this.apiOutput.Cooling.SetTemp
    : this.apiOutput.Heater.SetTemp;
}

RinnaiTouch.prototype = {
  identify: function(callback) {
    this.log('identify');
    callback();
  },

  refreshData: function() {
    exec(
      'python ' +
        __dirname +
        '/node_modules/rinnai-touch-python-interface/rinnai-touch-status.py ' +
        this.ip,
      function(error, stdout, stderr) {
        try {
          const data = JSON.parse(stdout);
          this.apiOutput = data.Status;

          this.values.Active = this.apiOutput.System.SystemOn
            ? Characteristic.Active.ACTIVE
            : Characteristic.Active.INACTIVE;
          this.values.CurrentTemperature = this.apiOutput.System.CoolingMode
            ? this.apiOutput.Cooling.SetTemp
            : this.apiOutput.Heater.SetTemp;
          this.values.ThresholdTemperature = this.apiOutput.System.CoolingMode
            ? this.apiOutput.Cooling.SetTemp
            : this.apiOutput.Heater.SetTemp;
        } catch {}
      }.bind(this),
    );
  },

  getServices: function() {
    this.hcService = new Service.HeaterCooler(this.name);

    this.hcService
      .getCharacteristic(Characteristic.Active)
      .on('get', this._getValue.bind(this, 'Active'))
      .on('set', this._setValue.bind(this, 'Active'));

    this.hcService
      .getCharacteristic(Characteristic.TargetTemperature)
      .setProps({
        minValue: 16,
        maxValue: 30,
        minStep: 1,
      })
      .on('get', this._getValue.bind(this, 'ThresholdTemperature'))
      .on('set', this._setValue.bind(this, 'ThresholdTemperature'));

    this.hcService
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: 16,
        maxValue: 30,
        minStep: 1,
      })
      .on('set', this._setValue.bind(this, 'ThresholdTemperature'));

    this.hcService
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .setProps({
        minValue: 8,
        maxValue: 30,
        minStep: 1,
      })
      .on('set', this._setValue.bind(this, 'ThresholdTemperature'));

    this.hcService
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
	  .setProps({
		  validValues: [1, 2]
	  })
      .on('set', this._setValue.bind(this, 'TargetHeaterCoolerState'));

    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, 'Rinnai')
      .setCharacteristic(Characteristic.Model, 'N-BW2')
      .setCharacteristic(Characteristic.FirmwareRevision, this.version)
      .setCharacteristic(Characteristic.SerialNumber, this.device);

    return [this.informationService, this.hcService];
  },

  _getValue: function(CharacteristicName, callback) {
    if (this.debug) {
      this.log('GET', CharacteristicName);
    }

    switch (CharacteristicName) {
      case 'Active':
        this.values.Active = this.apiOutput.System.SystemOn;
        this.log('GET', 'Active', this.values.Active);
        callback(null, this.values.Active);
        break;

      case 'CurrentTemperature':
      case 'ThresholdTemperature':
        switch (this.apiOutput.System.CurrentMode) {
          case 'COOLING':
            this.values.CurrentTemperature = this.apiOutput.Cooling.SetTemp;
            this.values.ThresholdTemperature = this.apiOutput.Cooling.SetTemp;
            this.hcService
              .getCharacteristic(Characteristic.CoolingThresholdTemperature)
              .updateValue(this.values.ThresholdTemperature);
            this.hcService
              .getCharacteristic(Characteristic.CurrentTemperature)
              .updateValue(this.values.CurrentTemperature);

            this.hcService
              .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
              .updateValue(Characteristic.CurrentHeaterCoolerState.COOLING);
            this.hcService
              .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
              .updateValue(Characteristic.CurrentHeatingCoolingState.COOLING);
            this.hcService
              .getCharacteristic(Characteristic.TargetHeaterCoolerState)
              .updateValue(Characteristic.TargetHeaterCoolerState.COOL);
            break;

          case 'HEATING':
            this.values.CurrentTemperature = this.apiOutput.Heater.SetTemp;
            this.values.ThresholdTemperature = this.apiOutput.Heater.SetTemp;
            this.hcService
              .getCharacteristic(Characteristic.ThresholdTemperature)
              .updateValue(this.values.CurrentTemperature);
            this.hcService
              .getCharacteristic(Characteristic.CurrentTemperature)
              .updateValue(this.values.CurrentTemperature);

            this.hcService
              .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
              .updateValue(Characteristic.CurrentHeaterCoolerState.HEATING);
            this.hcService
              .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
              .updateValue(Characteristic.CurrentHeatingCoolingState.HEATING);
            this.hcService
              .getCharacteristic(Characteristic.TargetHeaterCoolerState)
              .updateValue(Characteristic.TargetHeaterCoolerState.HEAT);
            break;

          default:
            this.hcService
              .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
              .updateValue(Characteristic.CurrentHeaterCoolerState.IDLE);
        }
        this.log('GET', CharacteristicName, this.values[CharacteristicName]);
        callback(null, this.values[CharacteristicName]);
        break;

      default:
        callback(null);
        break;
    }
  },

  _setValue: function(CharacteristicName, value, callback) {
    if (this.debug) {
      this.log('SET', CharacteristicName, value);
    }

    var parameters = [];
    var actionSet = false;

    switch (CharacteristicName) {
      case 'Active':
        actionSet = true;
        switch (value) {
          case Characteristic.Active.ACTIVE:
            parameters.push('--action=on');
			parameters.push('--mode=cool');
            break;

          default:
            parameters.push('--action=off');
			parameters.push('--mode=cool');
            break;
        }
        break;

      case 'TargetHeaterCoolerState':
        if (!actionSet) {
          parameters.push('--action=on');
        }
        switch (value) {
          case Characteristic.TargetHeaterCoolerState.COOL:
            parameters.push('--mode=cool');
            this.hcService
              .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
              .updateValue(3);
            break;

          case Characteristic.TargetHeaterCoolerState.HEAT:
            parameters.push('--mode=heat');
            this.hcService
              .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
              .updateValue(2);
            break;
        }
        break;

      case 'ThresholdTemperature':
        if (!actionSet) {
          parameters.push('--action=on');
          parameters.push('--mode=cool');
        }
        // parameters.push('--heatTemp=' + value);
        parameters.push('--coolTemp=' + value);
        break;
    }

    this.log('SET', parameters.join(' '));

    exec(
      'python ' +
        __dirname +
        '/node_modules/rinnai-touch-python-interface/rinnai-touch-client.py ' +
        this.ip +
        ' ' +
        parameters.join(' '),
      function(error, stdout, stderr) {},
    );
  },
};
