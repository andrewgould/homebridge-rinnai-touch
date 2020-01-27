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

  this.values = [];
  this.values.Active = this.apiOutput.System.SystemOn
    ? Characteristic.Active.ACTIVE
    : Characteristic.Active.INACTIVE;
  if (this.apiOutput.System.SystemOn) {
    this.values.ThresholdTemperature = this.apiOutput.System.CoolingMode
      ? this.apiOutput.Cooling.SetTemp
      : this.apiOutput.Heater.SetTemp;
  } else {
    this.values.ThresholdTemperature = 22;
  }
  this.values.CurrentTemperature = this.values.ThresholdTemperature;
  this.values.CurrentMode = this.apiOutput.System.CurrentMode;
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
          if (this.apiOutput.System.SystemOn) {
            this.values.ThresholdTemperature = this.apiOutput.System.CoolingMode
              ? this.apiOutput.Cooling.SetTemp
              : this.apiOutput.Heater.SetTemp;
            this.values.CurrentTemperature = this.apiOutput.System.CoolingMode
              ? this.apiOutput.Cooling.SetTemp
              : this.apiOutput.Heater.SetTemp;
          } else {
            this.values.CurrentTemperature = 21;
            this.values.ThresholdTemperature = 22;
          }

          this.hcService
            .getCharacteristic(Characteristic.Active)
            .updateValue(this.values.Active);

          this.hcService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(this.values.CurrentTemperature);

          this.hcService
            .getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .updateValue(this.values.ThresholdTemperature);
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
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this._getValue.bind(this, 'CurrentTemperature'))
      .on('set', this._setValue.bind(this, 'CurrentTemperature'));

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
        validValues: [1, 2],
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

      case 'ThresholdTemperature':
        callback(null, this.values.ThresholdTemperature);
        break;

      case 'CurrentTemperature':
        switch (this.apiOutput.System.CurrentMode) {
          case 'COOLING':
            this.values.CurrentTemperature = this.apiOutput.Cooling.SetTemp;
            this.values.ThresholdTemperature = this.apiOutput.Cooling.SetTemp;
            this.hcService
              .getCharacteristic(Characteristic.CoolingThresholdTemperature)
              .updateValue(this.values.ThresholdTemperature);

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
              .getCharacteristic(Characteristic.HeatingThresholdTemperature)
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
        switch (this.apiOutput.System.CurrentMode) {
          case 'COOLING':
            parameters.push('--mode=cool');
            break;

          case 'HEATING':
            parameters.push('--mode=heat');
        }
        switch (value) {
          case Characteristic.Active.ACTIVE:
            parameters.push('--action=on');
            break;

          default:
            parameters.push('--action=off');
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
            this.apiOutput.System.CurrentMode = 'COOLING';
            this.hcService
              .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
              .updateValue(3);
            break;

          case Characteristic.TargetHeaterCoolerState.HEAT:
            parameters.push('--mode=heat');
            this.apiOutput.System.CurrentMode = 'HEATING';
            this.hcService
              .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
              .updateValue(2);
            break;
        }
        break;

      case 'ThresholdTemperature':
        parameters.push('--action=on');
        switch (this.apiOutput.System.CurrentMode) {
          case 'COOLING':
            parameters.push('--mode=cool');
            parameters.push('--coolTemp=' + value);
            break;

          case 'HEATING':
            parameters.push('--mode=heat');
            parameters.push('--heatTemp=' + value);
        }
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
      function() {
        this.hcService
          .getCharacteristic(Characteristic.StatusFault)
          .updateValue(Characteristic.StatusFault.NO_FAULT);
        callback();
      }.bind(this),
    );
  },
};
