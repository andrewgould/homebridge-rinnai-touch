# homebridge-rinnai-touch
Rinnai Touch plugin for [HomeBridge](https://github.com/nfarina/homebridge) using a Python API to communicate with HomeKit.

The Python API that this depends on was based on the following gists from @christhehoff:
* https://gist.github.com/christhehoff/7d45346222e907dbf01416ef0f06669d
* https://gist.github.com/christhehoff/fcdb75f33059378c1e511b704ff4dffe

## Things to know
* There's still a lot of work to do on this project.
* The Rinnai Touch hardware seems to be unreliable: when turning on the heating or cooling the device becomes unresponsive for a few minutes.
* HomeKit doesn't appear support evaporative cooling with the interfaces used here.
* HomeKit also doesn't support zones for centralised units.
* I've tested this on a Brivis/Rinnai Networker NC-6 unit, which seems limited compared to the promotional screenshots from Rinnai.
* I've only played with a small amount of the functionality that could theoretically be used.

## Getting started

### Supported devices
Rinnai Touch

### Legal
* Licensed under [MIT](LICENSE)
* This is not an official plug-in and is not affiliated with Rinnai or Brivis in any way
