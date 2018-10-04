var notificationId;
var countdownId;
var breakId;
var config = {};
var idleState = 'active';
var idleStart;
var alarmName = 'breakAlarm';
var fullscreenTimeout;
var isFirefox = navigator.userAgent.indexOf("Firefox") > -1

var defaultConfig = {
  frequency: 28,
  length: 2,
  postpone: 3,
  notificationType: 'F',
  workingHoursFrom: '09:00',
  workingHoursTo: '17:30',
  workingHoursDays: [
    {
      name: 'Mon',
      enabled: true
    },
    {
      name: 'Tue',
      enabled: true
    },
    {
      name: 'Wed',
      enabled: true
    },
    {
      name: 'Thu',
      enabled: true
    },
    {
      name: 'Fri',
      enabled: true
    },
    {
      name: 'Sat',
      enabled: false
    },
    {
      name: 'Sun',
      enabled: false
    }
  ],
  workingHoursEnabled: true,
  idleResetMinutes: 5,
  idleResetEnabled: true,
  breaksEnabled: true,
  gongEnabled: true,
  breakText: 'Time for a break!',
  breakMessage: 'Rest your eyes. Stretch your legs. Breathe. Relax.',
  backgroundColor: '#16a085',
  textColor: '#ffffff',
  allowEndBreak: true,
  allowSkipBreak: true,
  allowPostponeBreak: true,
};

// Grab config from local storage mergded with defaultConfig
chrome.storage.local.get('config', function(data) {
  let localConfig = Object.assign({}, defaultConfig, data.config);
  setConfig(localConfig);
});

function clearFullscreenNotification() {
  clearTimeout(fullscreenTimeout);
  if (typeof(countdownId) !== 'undefined') {
    chrome.notifications.clear(countdownId, function() {});
  }
}

function createFullscreen() {
  clearFullscreenNotification();
  playGong();

  const opts =  {
    url: '../templates/break.html',
    type: 'panel',
  }

  if (!isFirefox) {
    opts.focused = true
  }

  chrome.windows.create(
    opts,
    function(breakWindow) {
      breakId = breakWindow.id;
      chrome.windows.update(breakWindow.id, {
        state: 'fullscreen'
      });
    }
  );
}

function createFullscreenNotification() {
  // Create a complex notification with countdown to fullscreen break

  let notificationOptions

  if (!isFirefox) {

    notificationOptions = {
      type: 'basic',
      requireInteraction: true,
      iconUrl: 'image/icon128.png',
      priority: 2,
      title: config.breakText,
      message: 'Break about to start...',
      isClickable: true,
    };

    if (config.allowSkipBreak || config.allowPostponeBreak) {
      notificationOptions.buttons = []
      if (config.allowSkipBreak) {
        notificationOptions.buttons.push(
          {title: 'Skip', iconUrl: 'image/skip.png'},
        )
      }
      if (config.allowPostponeBreak) {
        notificationOptions.buttons.push(
          {title: 'Postpone ' + config.postpone + ' minutes', iconUrl: 'image/postpone.png'}
        )
      }
    }

    chrome.notifications.create(
      'countdown',
      notificationOptions,
      function(newNotificationId) {
        countdownId = newNotificationId;

        fullscreenTimeout = setTimeout(function() {
          createFullscreen();
        }, 10000);
      });

  } else {

    // Unfortunately, more advanced options are currently unimplemented in
    // Firefox - // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/notifications/NotificationOptions
    notificationOptions = {
      type: 'basic',
      iconUrl: 'image/icon128.png',
      title: config.breakText,
      message: 'Break about to start...'
    };

    browser.notifications.create(
      'countdown',
      notificationOptions,
      function(newNotificationId) {
        countdownId = newNotificationId;

        setTimeout(function() {
          createFullscreen();
        }, 5000);
      });

  }
}

function createNotification() {
  // Create simple alert notification

  playGong();

  chrome.notifications.create('reminder', {
    type: 'basic',
    iconUrl: 'image/icon128.png',
    title: config.breakText,
    message: config.breakMessage,
  }, function(newNotificationId) {
    notificationId = newNotificationId;
  });

  // Create the next alarm
  createAlarm();

  // Clear notification after 5 seconds
  setTimeout(function() {
    chrome.notifications.clear(notificationId, function() {});
  }, 8000);
}

function checkOutsideWorkingHours() {
  if (config.workingHoursEnabled === false) {
    return false;
  }

  var workingHoursFrom = moment(
    config.workingHoursFrom,
    'HH:mm'
  );
  var workingHoursTo = moment(
    config.workingHoursTo,
    'HH:mm'
  );
  var now = moment();
  workingDayEnabled = getWorkingDayEnabled(now.format('ddd'));
  return !(
    (workingDayEnabled) &&
    (workingHoursFrom <= now) &&
    (now <= workingHoursTo)
  );
}

function getWorkingDayEnabled(day) {
  workingDayEnabled = null;
  config.workingHoursDays.forEach(function(whDay) {
    if (whDay.name === day) {
      workingDayEnabled = whDay.enabled;
    }
  });
  return workingDayEnabled;
}

function handleAlarm() {
  if (checkOutsideWorkingHours()) {
    createAlarm();
  } else if (config.idleResetEnabled &&
    ['idle', 'locked'].indexOf(idleState) > -1 &&
    checkIdleMinutes()) {
    // Prevent breaks when we've been idle for more than
    // config.idleResetMinutes minutes
    createAlarm();
  } else {
    if (config.notificationType === 'N') {
      createNotification();
    } else if (config.notificationType === 'F') {
      createFullscreenNotification();
    }
  }
}

function playGong() {
  if (config.gongEnabled) {
    const gongAudio = new Audio();
    gongAudio.src = '../sounds/gong.wav';
    gongAudio.play();
  }
}

function playGongLow() {
  if (config.gongEnabled) {
    const gongAudio = new Audio();
    gongAudio.src = '../sounds/gong_low.wav';
    gongAudio.play();
  }
}

function startBreak() {
  if (config.notificationType === 'N') {
    createNotification();
  } else if (config.notificationType === 'F') {
    createFullscreen();
  }
}

function endBreak() {
  chrome.windows.remove(breakId)
}

// When the user clicks on the notification, close it
chrome.notifications.onClicked.addListener(function(id) {
  chrome.notifications.clear(id, function() {});
});

// When the user clicks on a notification button, handle it
chrome.notifications.onButtonClicked.addListener(function(id, buttonIndex) {
  function skip() {
    clearFullscreenNotification();
    createAlarm();
  }

  function postpone() {
    clearFullscreenNotification();
    createAlarm(config.postpone);
  }

  if (id === countdownId) {
    if (config.allowSkipBreak && config.allowPostponeBreak) {
      if (buttonIndex === 0) {
        skip()
      } else if (buttonIndex === 1) {
        postpone()
      }
    } else if (!config.allowSkipBreak && config.allowPostponeBreak) {
      if (buttonIndex === 0) {
        postpone()
      }
    } else if (config.allowSkipBreak && !config.allowPostponeBreak) {
      if (buttonIndex === 0) {
        skip()
      }
    }
  }
});

// Set idle detection interval to 15 seconds
chrome.idle.setDetectionInterval(15);

function checkIdleMinutes() {
  // Check if user has been idle for more than configured minutes

  var idleMinutes = moment().diff(idleStart, 'minutes');
  if (idleMinutes > config.idleResetMinutes) {
    return true;
  } else {
    return false;
  }
}

// Handle user state idle change
chrome.idle.onStateChanged.addListener(function (newState) {
  if (config.idleResetEnabled) {
    idleState = newState;

    // Reset countdown when returning from idle period of more than
    // config.idleResetMinutes minutes
    if (['idle', 'locked'].indexOf(idleState) > -1) {
      idleStart = moment();
    } else if (idleState === 'active') {
      if (checkIdleMinutes()) {
        createAlarm();
      }
    }
  }
});

// Create a new alarm when the break window is closed
chrome.windows.onRemoved.addListener(function(windowId) {
  if (windowId === breakId) {
    playGongLow();
    createAlarm();
  }
});

chrome.alarms.onAlarm.addListener(handleAlarm);

function createAlarm(minutes) {
  if (typeof(minutes) === 'undefined') {
    minutes = Number(config.frequency);
  }

  chrome.alarms.create(alarmName, {
    delayInMinutes: minutes
  });
  chrome.alarms.get(alarmName, function(alarm) {
    alarmTime = new Date(alarm.scheduledTime);
    window.alarm = alarm;
    chrome.runtime.sendMessage({
      event: "alarmCreated",
      alarm: alarm
    }, function() {});
  });
}

function setConfig(newConfig) {
  config = newConfig;
  window.config = config;
  chrome.storage.local.set({
    config: newConfig
  });

  if (config.breaksEnabled) {
    createAlarm();
  }
}

// Handle runtime messages from other pages in the app
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch (request.event) {
      case 'setConfig':
        setConfig(request.config);
        break;
      case 'clearFullscreenNotification':
        clearFullscreenNotification()
        break;
      case 'createAlarm':
        createAlarm(request.minutes);
        break;
      case 'cancelAlarm':
        chrome.alarms.clear(alarmName);
        window.alarm = null;
        break;
      case 'startBreak':
        startBreak();
        break;
      case 'endBreak':
        endBreak();
        break;
    }
    sendResponse({success: true});
  }
);
