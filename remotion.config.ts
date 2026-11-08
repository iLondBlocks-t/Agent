import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('swangle');
Config.setBrowserExecutable('/tmp/chromium');
Config.setDelayRenderTimeoutInMilliseconds(60000);
