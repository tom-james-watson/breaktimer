var notificationId;
var config = {};
var defaults = {
    frequency: 28,
    length: 2
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
        },
        function(popupWindow) {
            popupWindow.contentWindow.config = config;
        }
    );
}

function handleAlarm() {
    // Now create the notification
    //chrome.notifications.create('reminder', {
    //    type: 'basic',
    //    iconUrl: 'image/icon128.png',
    //    title: 'Don\'t forget!',
    //    message: 'Take a break, mate.'
    //}, function(newNotificationId) {
    //    notificationId = newNotificationId;
    //});

    // Clear notification after 5 seconds
    //setTimeout(function() {
    //    chrome.notifications.clear(notificationId, function() {});
    //}, 5000);

    var x = chrome.app.window.create(
        '../templates/break.html',
        {
            id: 'break',
            state: 'fullscreen',
        },
        function(breakWindow) {
            breakWindow.contentWindow.config = config;
            breakWindow.onClosed.addListener(function() {
                createAlarm();
            });
        }
    );

    // Create the next alarm
    //createAlarm();
}

// When the user clicks on the notification, we want to TODO
chrome.notifications.onClicked.addListener(function() {
    launch();
    chrome.notifications.clear(notificationId, function() {});
});

chrome.app.runtime.onLaunched.addListener(launch);

chrome.alarms.onAlarm.addListener(handleAlarm);

function createAlarm() {
    chrome.alarms.create(alarmName, {
        delayInMinutes: Number(config.frequency)
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
    chrome.storage.local.set({
        config: newConfig
    });
    createAlarm();
}

// Handle runtime messages from other pages in the app
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

// Grab config from local storage or take defaults
chrome.storage.local.get('config', function(data) {
    if (typeof(data.config) === 'undefined') {
        setConfig(defaults);
    } else {
        setConfig(data.config);
    }
});

// Listen for changes to local storage config
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && 'config' in changes) {
        setConfig(changes.config.newValue);
    }
});

