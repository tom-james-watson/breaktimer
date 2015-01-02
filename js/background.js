var notificationId;
var config = {};
var defaults = {
    frequency: 20,
    length: 0.1
};
var alarmName = 'breakAlarm';

function launch() {
    chrome.app.window.create(
        '../templates/popup.html',
        {
            id: 'main',
            outerBounds: { width: 480, height: 300 },
            //frame: {
            //    type: 'chrome',
            //    color: '#444'
            //},
            //frame: 'none', TODO - add draggable frame
            // alphaEnabled: false - TODO - revisit (experimental feature)
        }
    );
}

function handleAlarm() {
    // Now create the notification
    chrome.notifications.create('reminder', {
        type: 'basic',
        iconUrl: 'image/icon128.png',
        title: 'Don\'t forget!',
        message: 'Take a break, mate.'
    }, function(newNotificationId) {
        notificationId = newNotificationId;
    });

    // Clear notification after 5 seconds
    setTimeout(function() {
        console.log(notificationId)
        chrome.notifications.clear(notificationId, function() {});
    }, 5000);

    // Create the next alarm
    createAlarm();
}

// When the user clicks on the notification, we want to TODO
chrome.notifications.onClicked.addListener(function() {
    launch();
    chrome.notifications.clear(notificationId, function() {});
});

chrome.app.runtime.onLaunched.addListener(launch);

chrome.alarms.onAlarm.addListener(handleAlarm);

function createAlarm(minutes) {
    console.log('createAlarm');
    chrome.alarms.create(alarmName, {
        delayInMinutes: Number(config.length)
    });
    chrome.alarms.get(alarmName, function(alarm) {
        chrome.runtime.sendMessage({
            event: "alarmCreated",
            alarm: alarm
        }, function() {});
    });
}

function setConfig(newConfig) {
    config = newConfig;
    createAlarm();
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        switch (request.event) {
            case 'setConfig':
                setConfig(request.config);
            case 'createAlarm':
                createAlarm();
        }
        sendResponse({success: true});
    }
);

chrome.storage.local.get('config', function(data) {
    if ('length' in data.config && 'frequency' in data.config) {
        setConfig(data.config);
    } else {
        setConfig(defaults);
    }
});
