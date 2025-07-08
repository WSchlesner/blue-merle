'use strict';
'require view';
'require fs';
'require ui';
'require rpc';
'require uci';

const CONFIG_PATH = '/etc/config/blue-merle';

var css = '                             \
    .bm-main-controls {                 \
        display: grid;                  \
        grid-template-columns: 1fr 1fr; \
        gap: 1em;                       \
        margin: 1em 0;                  \
        align-items: start;             \
    }                                   \
                                        \
    .bm-control-group {                 \
        display: flex;                  \
        flex-direction: column;         \
        gap: 0.5em;                     \
    }                                   \
                                        \
    .bm-control-group label {           \
        font-weight: bold;              \
        color: #404040;                 \
        margin-bottom: 0.25em;          \
    }                                   \
                                        \
    .bm-control-group input {           \
        padding: 0.5em;                 \
        border: 1px solid #ccc;         \
        border-radius: 3px;             \
        background: #f8f8f8;            \
        font-family: monospace;         \
        font-size: 0.9em;               \
    }                                   \
                                        \
    .bm-control-group input:disabled {  \
        background: #f0f0f0;            \
        color: #666;                    \
    }                                   \
                                        \
    .bm-section {                       \
        margin: 1.5em 0;                \
        padding: 0;                     \
    }                                   \
                                        \
    .bm-section h3 {                    \
        margin: 0 0 1em 0;              \
        font-size: 1.1em;              \
        font-weight: bold;              \
        color: #404040;                 \
        border-bottom: 1px solid #ccc;  \
        padding-bottom: 0.5em;          \
    }                                   \
                                        \
    .bm-form-group {                    \
        display: flex;                  \
        align-items: center;            \
        margin: 0.75em 0;               \
        min-height: 2.5em;              \
    }                                   \
                                        \
    .bm-form-group label {              \
        display: inline-block;          \
        width: 12em;                    \
        font-weight: normal;            \
        margin-right: 1em;              \
        vertical-align: top;            \
        line-height: 1.8;               \
        color: #404040;                 \
    }                                   \
                                        \
    .bm-form-group select,              \
    .bm-form-group input {              \
        padding: 0.3em 0.5em;           \
        border: 1px solid #ccc;         \
        border-radius: 3px;             \
        background: #fff;               \
        min-width: 15em;                \
        color:rgb(0, 0, 0);               \
    }                                   \
                                        \
    .bm-form-group select:focus,        \
    .bm-form-group input:focus {        \
        border-color: #0099cc;          \
        outline: none;                  \
        box-shadow: 0 0 3px rgba(0,153,204,0.3); \
    }                                   \
                                        \
    .bm-form-group input.error {        \
        border-color: #dc3545;          \
        box-shadow: 0 0 3px rgba(220,53,69,0.3); \
    }                                   \
                                        \
    .bm-form-group input.warning {      \
        border-color: #ffc107;          \
        box-shadow: 0 0 3px rgba(255,193,7,0.3); \
    }                                   \
                                        \
    .bm-form-group input.success {      \
        border-color: #28a745;          \
        box-shadow: 0 0 3px rgba(40,167,69,0.3); \
    }                                   \
                                        \
    .bm-button-group {                  \
        margin: 1em 0;                  \
        padding: 1em 0;                 \
        border-top: 1px solid #eee;     \
        display: flex;                  \
        gap: 0.5em;                     \
        align-items: center;            \
    }                                   \
                                        \
    .bm-button-group.primary {          \
        border-top: 2px solid #0099cc;  \
        background: #f8fcff;            \
        padding: 1em;                   \
        border-radius: 3px;             \
        margin: 1.5em 0;                \
    }                                   \
                                        \
    .bm-button-group label {            \
        font-weight: bold;              \
        color: #404040;                 \
        margin-right: 1em;              \
        min-width: 8em;                 \
    }                                   \
                                        \
    .bm-randomization-grid {            \
        display: grid;                  \
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); \
        gap: 0.5em;                     \
        margin-top: 0.5em;              \
    }                                   \
                                        \
    .bm-status-indicator {              \
        display: inline-block;          \
        width: 8px;                     \
        height: 8px;                    \
        border-radius: 50%;             \
        margin-right: 0.5em;            \
        background: #ccc;               \
    }                                   \
                                        \
    .bm-status-indicator.enabled {      \
        background: #4CAF50;            \
    }                                   \
                                        \
    .bm-status-indicator.disabled {     \
        background: #f44336;            \
    }                                   \
                                        \
    .bm-info-text {                     \
        color: #666;                    \
        font-size: 0.9em;              \
        margin-top: 0.5em;              \
        font-style: italic;             \
    }                                   \
                                        \
    .bm-warning {                       \
        background: #fff3cd;            \
        border: 1px solid #ffeaa7;      \
        border-radius: 3px;             \
        padding: 0.75em;                \
        margin: 1em 0;                  \
        color: #856404;                 \
    }                                   \
                                        \
    .bm-warning::before {               \
        content: "⚠ ";                  \
        font-weight: bold;              \
    }                                   \
                                        \
    .bm-imei-validation {               \
        margin: 0.5em 0;                \
        padding: 0.5em;                 \
        border-radius: 3px;             \
        font-size: 0.9em;               \
        display: none;                  \
    }                                   \
                                        \
    .bm-imei-validation.error {         \
        background: #f8d7da;            \
        border: 1px solid #f5c6cb;      \
        color: #721c24;                 \
    }                                   \
                                        \
    .bm-imei-validation.warning {       \
        background: #fff3cd;            \
        border: 1px solid #ffeaa7;      \
        color: #856404;                 \
    }                                   \
                                        \
    .bm-imei-validation strong {        \
        font-family: monospace;         \
        background: rgba(255,255,255,0.5); \
        padding: 0.2em 0.4em;           \
        border-radius: 2px;             \
    }                                   \
                                        \
    #static-imei-input {                \
        width: 15em;                    \
        font-family: monospace;         \
    }                                   \
                                        \
    @media (max-width: 768px) {         \
        .bm-main-controls {             \
            grid-template-columns: 1fr; \
        }                               \
        .bm-randomization-grid {        \
            grid-template-columns: 1fr; \
        }                               \
        .bm-form-group {                \
            flex-direction: column;     \
            align-items: flex-start;    \
        }                               \
        .bm-form-group label {          \
            width: auto;                \
            margin-bottom: 0.5em;       \
        }                               \
    }                                   \
';

var isReadonlyView = !L.hasViewPermission() || null;

var callMountPoints = rpc.declare({
    object: 'luci',
    method: 'getMountPoints',
    expect: { result: [] }
});

var packages = {
    available: { providers: {}, pkgs: {} },
    installed: { providers: {}, pkgs: {} }
};

var languages = ['en'];

var currentDisplayMode = 'available', currentDisplayRows = [];

// IMEI validation functions - FIXED VERSION
function calculateLuhnCheckDigit(baseImei) {
    let doubled = '';
    for (let i = 0; i < baseImei.length; i++) {
        if (i % 2 === 0) {
            doubled += baseImei[i];
        } else {
            doubled += (parseInt(baseImei[i]) * 2).toString();
        }
    }
    
    let sum = 0;
    for (let digit of doubled) {
        sum += parseInt(digit);
    }
    
    return (10 - (sum % 10)) % 10;
}

function validateImei(imei) {
    // Handle empty input
    if (!imei) {
        return { valid: false, error: "IMEI must be exactly 15 digits" };
    }
    
    // Check if all characters are digits
    if (!/^\d+$/.test(imei)) {
        return { valid: false, error: "IMEI must contain only digits" };
    }
    
    // Handle different lengths
    if (imei.length < 14) {
        return { valid: false, error: "IMEI must be exactly 15 digits" };
    } else if (imei.length === 14) {
        // 14-digit IMEI - show completion message
        const correctCheckDigit = calculateLuhnCheckDigit(imei);
        const completedImei = imei + correctCheckDigit;
        return { 
            valid: false, 
            completable: true,
            correctCheckDigit: correctCheckDigit,
            correctedImei: completedImei,
            error: `Check digit should be ${correctCheckDigit}, not 4. Correct IMEI: ${completedImei}`
        };
    } else if (imei.length === 15) {
        // 15-digit IMEI - validate check digit
        const baseImei = imei.substring(0, 14);
        const inputCheckDigit = parseInt(imei.charAt(14));
        const correctCheckDigit = calculateLuhnCheckDigit(baseImei);
        
        if (inputCheckDigit === correctCheckDigit) {
            return { valid: true };
        } else {
            const correctedImei = baseImei + correctCheckDigit;
            return { 
                valid: false, 
                correctable: true,
                inputCheckDigit: inputCheckDigit,
                correctCheckDigit: correctCheckDigit,
                correctedImei: correctedImei,
                error: `Check digit should be ${correctCheckDigit}, not ${inputCheckDigit}. Correct IMEI: ${correctedImei}`
            };
        }
    } else {
        // More than 15 digits
        return { valid: false, error: "IMEI must be exactly 15 digits" };
    }
}

function showImeiValidation(input, validationResult) {
    const validationDiv = document.getElementById('imei-validation');
    
    if (validationResult.valid) {
        input.className = input.className.replace(/\b(error|warning|success)\b/g, '') + ' success';
        if (validationDiv) validationDiv.style.display = 'none';
    } else if (validationResult.correctable || validationResult.completable) {
        input.className = input.className.replace(/\b(error|warning|success)\b/g, '') + ' warning';
        showImeiMessage(validationResult.error, 'warning');
    } else {
        input.className = input.className.replace(/\b(error|warning|success)\b/g, '') + ' error';
        showImeiMessage(validationResult.error, 'error');
    }
}

function showImeiMessage(message, type) {
    let validationDiv = document.getElementById('imei-validation');
    
    if (!validationDiv) {
        validationDiv = document.createElement('div');
        validationDiv.id = 'imei-validation';
        validationDiv.className = 'bm-imei-validation';
        
        const staticInput = document.getElementById('static-imei-input');
        staticInput.parentNode.insertBefore(validationDiv, staticInput.nextSibling);
    }
    
    validationDiv.className = 'bm-imei-validation ' + type;
    validationDiv.innerHTML = message;
    validationDiv.style.display = 'block';
}

function hideImeiValidation() {
    const validationDiv = document.getElementById('imei-validation');
    if (validationDiv) validationDiv.style.display = 'none';
}

function updateSaveButtonState() {
    const saveButton = document.getElementById('save-config-button');
    if (!saveButton) return;
    
    // Save button is always enabled - auto-correction happens on save
    saveButton.disabled = isReadonlyView;
}

function handleReset(ev) {
}

function callBlueMerle(arg) {
    const cmd = "/usr/libexec/blue-merle";
    var prom = fs.exec(cmd, [arg]);
    return prom.then(
        function(res) {
            console.log("Blue Merle arg", arg, "res", res);
            if (res.code != 0) {
                throw new Error("Return code " + res.code);
            } else {
                return res.stdout;
            }
        }
    ).catch(
        function(err) {
            console.log("Error calling Blue Merle", arg, err);
            throw err;
        }
    );
}

function readIMEI() {
    return callBlueMerle("read-imei");
}

function randomIMEI() {
    callBlueMerle("random-imei").then(
        function(res){
            readIMEI().then(
                function(imei) {
                    console.log("new IMEI", imei);
                    var input = document.getElementById('imei-input');
                    if (input) input.value = imei.trim();
                }
            );
        }
    ).catch(
        function(err){
            console.log("Error", err);
        }
    );
}

function readIMSI() {
    return callBlueMerle("read-imsi");
}

function handleConfig(ev) {
    var conf = {};

    const cmd = "/usr/libexec/blue-merle";
    var dlg = ui.showModal(_('Executing blue merle'), [
        E('p', { 'class': 'spinning' },
            _('Waiting for the <em>%h</em> command to complete…').format(cmd))
    ]);

    var argv = ["random-imei"];
    console.log("Calling ", cmd, argv);
    
    fs.exec_direct(cmd, argv, 'text').then(function(res) {
        console.log("Res:", res, "stdout", res.stdout, "stderr", res.stderr, "code", res.code);

        if (res.stdout)
            dlg.appendChild(E('pre', [ res.stdout ]));

        if (res.stderr) {
            dlg.appendChild(E('h5', _('Errors')));
            dlg.appendChild(E('pre', { 'class': 'errors' }, [ res.stderr ]));
        }

        console.log("Res.code: ", res.code);
        if (res.code !== 0)
            dlg.appendChild(E('p', _('The <em>%h %h</em> command failed with code <code>%d</code>.').format(cmd, argv, (res.code & 0xff) || -1)));

        dlg.appendChild(E('div', { 'class': 'right' },
            E('div', {
                'class': 'btn',
                'click': function() {
                    if (ui.menu && ui.menu.flushCache)
                        ui.menu.flushCache();
                    ui.hideModal();
                }
            }, _('Dismiss'))));
    }).catch(function(err) {
        ui.addNotification(null, E('p', _('Unable to execute <em>%s</em> command: %s').format(cmd, err)));
        ui.hideModal();
    });
}

function handleShutdown(ev) {
    return ui.showModal(_('System Shutdown'), [
        E('p', {}, _('The system is shutting down now. Please wait...')),
        E('div', { 'class': 'right' }, [
            E('button', { 
                'class': 'btn cbi-button-neutral',
                'click': ui.hideModal 
            }, _('Cancel')),
            E('button', { 
                'class': 'btn cbi-button-negative',
                'click': function() {
                    callBlueMerle("shutdown").then(function() {
                        ui.hideModal();
                    });
                }
            }, _('Confirm Shutdown'))
        ])
    ]);
}

function handleRemove(ev) {
}

function handleSimSwap(ev) {
    const spinnerID = 'swap-spinner-id';
    var dlg = ui.showModal(_('SIM Swap Process'),
        [
            E('p', { 'class': 'spinning', 'id': spinnerID },
                _('Shutting down modem…')
             )
        ]
    );
    callBlueMerle("shutdown-modem").then(
        function(res) {
            dlg.appendChild(
                E('pre', { 'class': 'result'},
                    res
                )
            );
            dlg.appendChild(
                E('p', { 'class': 'text'},
                    _("Generating random IMEI...")
                )
            );
            callBlueMerle("random-imei").then(
                function(res) {
                    document.getElementById(spinnerID).style = "display:none";
                    dlg.appendChild(
                        E('div', { 'class': 'bm-section'},
                          [
                            E('p', { 'class': 'text'},
                                _("New IMEI assigned:") + " " + E('code', {}, res)
                            ),
                            E('div', { 'class': 'bm-warning' },
                                _("Important: Shutdown the device, swap the SIM card, then move to a different location before powering on.")
                            ),
                            E('div', { 'class': 'bm-button-group' }, [
                                E('button', { 'class': 'btn cbi-button-neutral', 'click': ui.hideModal },
                                    [ _('Cancel') ]
                                ),
                                E('button', { 'class': 'btn cbi-button-negative', 'click': handleShutdown, 'disabled': isReadonlyView },
                                    [ _('Shutdown Now') ]
                                )
                            ])
                          ]
                        )
                    )
                }
            ).catch(
                function(err) {
                    dlg.appendChild(
                        E('p',{'class': 'error'},
                            _('Error setting IMEI: ') + err
                        )
                    )
                }
            );
        }
    ).catch(
        function(err) {
            dlg.appendChild(
                E('p',{'class': 'error'},
                    _('Error: ') + err
                )
            )
        }
    );
}

function handleOpkg(ev) {
}

function handleUpload(ev) {
}

function handleInput(ev) {
}

// Function to check the state of the service
function checkServiceState(service) {
    return callBlueMerle('status-' + service).then(
        function(res) {
            return res.trim() === 'enabled';
        }
    ).catch(
        function(err) {
            console.log("Error checking service state", service, err);
            return false;
        }
    );
}

// Function to toggle the Blue-Merle Services On/Off at Startup/Boot/Runtime
function toggleService(service, button) {
    checkServiceState(service).then(
        function(isEnabled) {
            var command = isEnabled ? 'disable-' + service : 'enable-' + service;
            return callBlueMerle(command).then(
                function(res) {
                    console.log("Service", service, "command", command, "result", res);
                    updateServiceButton(button, service, !isEnabled);
                }
            ).catch(
                function(err) {
                    console.log("Error toggling service", service, err);
                    ui.addNotification(null, E('p', _('Error toggling %s: %s').format(service, err)));
                }
            );
        }
    );
}

function updateServiceButton(button, service, isEnabled) {
    var indicator = button.querySelector('.bm-status-indicator');
    var text = button.querySelector('.bm-button-text');
    
    if (indicator) {
        indicator.className = 'bm-status-indicator ' + (isEnabled ? 'enabled' : 'disabled');
    }
    if (text) {
        // Use the stored display name instead of reconstructing from service name
        var displayName = button.getAttribute('data-display-name') || service;
        text.textContent = (isEnabled ? 'Disable' : 'Enable') + ' ' + displayName;
    }
}

function createServiceButton(service, displayName) {
    var button = E('button', { 
        'class': 'btn cbi-button',
        'data-display-name': displayName,  // Store the proper display name
        'click': function() { toggleService(service, this); },
        'disabled': isReadonlyView 
    }, [
        E('span', { 'class': 'bm-status-indicator' }),
        E('span', { 'class': 'bm-button-text' }, _('Enable ') + displayName)
    ]);
    
    checkServiceState(service).then(function(state) {
        updateServiceButton(button, service, state);
    });
    
    return button;
}

// Helper to read UCI config
function readUciConfig() {
    return new Promise(function(resolve, reject) {
        uci.load('blue-merle').then(function() {
            var config = {
                imei_mode: uci.get('blue-merle', 'imei', 'mode') || 'random',
                static_imei: uci.get('blue-merle', 'imei', 'static_value') || ''
            };
            resolve(config);
        }).catch(function(err) {
            // If config doesn't exist, return defaults
            resolve({
                imei_mode: 'random',
                static_imei: ''
            });
        });
    });
}

// Helper to write UCI config - Improved version with better error handling
function writeUciConfig(config) {
    return new Promise(function(resolve, reject) {
        console.log("Attempting to write UCI config:", config);
        
        uci.load('blue-merle').then(function() {
            console.log("UCI blue-merle package loaded successfully");
            
            // Create the section if it doesn't exist
            if (!uci.get('blue-merle', 'imei')) {
                console.log("Creating new imei section");
                uci.add('blue-merle', 'imei', 'imei');
            } else {
                console.log("imei section already exists");
            }
            
            // Set the values
            console.log("Setting mode to:", config.imei_mode);
            uci.set('blue-merle', 'imei', 'mode', config.imei_mode);
            
            if (config.static_imei) {
                console.log("Setting static_value to:", config.static_imei);
                uci.set('blue-merle', 'imei', 'static_value', config.static_imei);
            } else {
                console.log("Unsetting static_value");
                uci.unset('blue-merle', 'imei', 'static_value');
            }
            
            // Save and commit changes
            console.log("Saving UCI changes...");
            return uci.save();
        }).then(function() {
            console.log("UCI save successful, applying changes...");
            return uci.apply();
        }).then(function() {
            console.log("UCI apply successful");
            resolve();
        }).catch(function(err) {
            console.error("UCI operation failed:", err);
            // Provide more specific error messages
            var errorMsg = "Unknown UCI error";
            if (err.toString().includes("Permission denied")) {
                errorMsg = "Permission denied - check file permissions on /etc/config/blue-merle";
            } else if (err.toString().includes("Invalid")) {
                errorMsg = "Invalid UCI configuration";
            }
            reject(errorMsg + ": " + err.toString());
        });
    });
}

// Global variables for IMEI config
var currentImeiMode = 'random';
var currentStaticImei = '';

function handleImeiModeChange(ev) {
    currentImeiMode = ev.target.value;
    var staticInput = document.getElementById('static-imei-input');
    var warningDiv = document.getElementById('static-imei-warning');
    
    if (staticInput) {
        staticInput.style.display = currentImeiMode === 'static' ? 'block' : 'none';
    }
    if (warningDiv) {
        warningDiv.style.display = currentImeiMode === 'static' ? 'block' : 'none';
    }
    
    hideImeiValidation();
    updateSaveButtonState();
}

function handleStaticImeiChange(ev) {
    currentStaticImei = ev.target.value;
    
    // Only validate if there's actual input
    if (currentStaticImei.length > 0) {
        const validationResult = validateImei(currentStaticImei);
        showImeiValidation(ev.target, validationResult);
    } else {
        // Reset styling for empty input
        ev.target.className = ev.target.className.replace(/\b(error|warning|success)\b/g, '');
        hideImeiValidation();
    }
    
    updateSaveButtonState();
}

function handleSaveImeiConfig(ev) {
    var config = {
        imei_mode: currentImeiMode
    };
    
    var validationResult = null;
    var imeiToSave = currentStaticImei;
    
    if (currentImeiMode === 'static') {
        if (!currentStaticImei) {
            ui.addNotification(null, E('p', _('Error: Please enter a static IMEI')));
            return;
        }
        
        // Validate the IMEI and get correction/completion if needed
        validationResult = validateImei(currentStaticImei);
        
        // Block invalid IMEIs (wrong length, invalid characters)
        if (!validationResult.valid && !validationResult.correctable && !validationResult.completable) {
            ui.addNotification(null, E('p', _('Error: ') + validationResult.error));
            return;
        }
        
        // Use corrected/completed IMEI if available
        if (validationResult.correctable || validationResult.completable) {
            imeiToSave = validationResult.correctedImei;
        }
        
        config.static_imei = imeiToSave;
    }
    
    writeUciConfig(config).then(function() {
        // Show appropriate success message
        if (validationResult && (validationResult.correctable || validationResult.completable)) {
            if (validationResult.completable) {
                ui.addNotification(null, E('p', _('14-digit IMEI completed and saved: ') + imeiToSave));
            } else {
                ui.addNotification(null, E('p', _('IMEI check digit corrected and saved: ') + imeiToSave));
            }
        } else {
            ui.addNotification(null, E('p', _('IMEI configuration saved successfully!')));
        }
        hideImeiValidation();
    }).catch(function(err) {
        console.log("Error saving UCI config:", err);
        ui.addNotification(null, E('p', _('Error saving IMEI configuration: ') + err));
    });
}

return view.extend({
    load: function() {
        return Promise.resolve();
    },

    render: function(listData) {
        var query = decodeURIComponent(L.toArray(location.search.match(/\bquery=([^=]+)\b/))[1] || '');

        var view = E([], [
            E('style', { 'type': 'text/css' }, [ css ]),

            E('h2', {}, _('Blue Merle - Identity Randomization')),

            // Current Status Section
            E('div', { 'class': 'bm-section' }, [
                E('h3', {}, _('Current Device Identity')),
                E('div', { 'class': 'bm-main-controls' }, [
                    E('div', { 'class': 'bm-control-group' }, [
                        E('label', {}, _('IMEI (International Mobile Equipment Identity)')),
                        E('input', { 
                            'id': 'imei-input', 
                            'type': 'text', 
                            'placeholder': _('Loading...'), 
                            'disabled': true 
                        }),
                        E('div', { 'class': 'bm-info-text' }, 
                            _('Unique identifier for your cellular modem')
                        )
                    ]),
                    E('div', { 'class': 'bm-control-group' }, [
                        E('label', {}, _('IMSI (International Mobile Subscriber Identity)')),
                        E('input', { 
                            'id': 'imsi-input', 
                            'type': 'text', 
                            'placeholder': _('Loading...'), 
                            'disabled': true 
                        }),
                        E('div', { 'class': 'bm-info-text' }, 
                            _('Unique identifier stored on your SIM card')
                        )
                    ])
                ])
            ]),

            // Primary Action Section
            E('div', { 'class': 'bm-section' }, [
                E('h3', {}, _('Primary Actions')),
                E('div', { 'class': 'bm-button-group primary' }, [
                    E('label', {}, _('SIM Swap:')),
                    E('button', { 
                        'class': 'btn cbi-button-action', 
                        'click': handleSimSwap, 
                        'disabled': isReadonlyView 
                    }, [ _('Initiate SIM Swap Process') ]),
                    E('div', { 'class': 'bm-info-text' }, 
                        _('Safely prepare device for SIM card replacement with new identity, will generate a random IMEI')
                    )
                ])
            ]),

            // IMEI Configuration Section
            E('div', { 'class': 'bm-section' }, [
                E('h3', {}, _('SIM Swap Switch: IMEI Generation Configuration')),
                
                E('div', { 'class': 'bm-form-group' }, [
                    E('label', {}, _('Generation Mode:')),
                    E('select', { 
                        'id': 'imei-mode-select',
                        'change': handleImeiModeChange
                    }, [
                        E('option', { 'value': 'random' }, _('Random - Generate completely random IMEI')),
                        E('option', { 'value': 'deterministic' }, _('Deterministic - Derive from IMSI hash')),
                        E('option', { 'value': 'static' }, _('Static - Use manually specified IMEI'))
                    ])
                ]),
                
                E('div', { 'class': 'bm-form-group' }, [
                    E('label', {}, _('Static IMEI:')),
                    E('input', { 
                        'id': 'static-imei-input',
                        'type': 'text', 
                        'placeholder': _('Enter 14 or 15-digit IMEI (e.g. 35674108123456)'), 
                        'maxlength': 15,
                        'style': 'display: none;',
                        'input': handleStaticImeiChange
                    })
                ]),
                
                E('div', { 'id': 'static-imei-warning', 'class': 'bm-warning', 'style': 'display: none;' },
                    _('Warning: Using the same static IMEI repeatedly may compromise your privacy and security.')
                ),
                
                E('div', { 'class': 'bm-button-group' }, [
                    E('button', { 
                        'id': 'save-config-button',
                        'class': 'btn cbi-button-positive',
                        'click': handleSaveImeiConfig,
                        'disabled': isReadonlyView
                    }, [ _('Save Configuration') ])
                ])
            ]),

            // Randomization Services Section
            E('div', { 'class': 'bm-section' }, [
                E('h3', {}, _('Additional Privacy Features')),
                E('div', { 'class': 'bm-button-group' }, [
                    E('label', {}, _('Network Randomization:')),
                    E('div', { 'class': 'bm-randomization-grid' }, [
                        createServiceButton('hostname', 'Hostname'),
                        createServiceButton('bssid', 'BSSID/MACADDR'),
                        createServiceButton('ssid', 'SSID'),
                        createServiceButton('password', 'Password')
                    ])
                ]),
                E('div', { 'class': 'bm-info-text' }, 
                    _('These services randomize various network identifiers on startup to enhance privacy')
                )
            ])
        ]);

        // Load current values after DOM is ready
        setTimeout(function() {
            // Load IMEI
            readIMEI().then(function(imei) {
                var input = document.getElementById('imei-input');
                if (input) {
                    input.value = imei.trim();
                    input.placeholder = _('IMEI loaded');
                }
            }).catch(function(err) {
                console.log("Error reading IMEI:", err);
                var input = document.getElementById('imei-input');
                if (input) {
                    input.value = "";
                    input.placeholder = _('Error reading IMEI');
                }
            });

            // Load IMSI
            readIMSI().then(function(imsi) {
                var input = document.getElementById('imsi-input');
                if (input) {
                    input.value = imsi.trim();
                    input.placeholder = _('IMSI loaded');
                }
            }).catch(function(err) {
                console.log("Error reading IMSI:", err);
                var input = document.getElementById('imsi-input');
                if (input) {
                    input.value = "";
                    input.placeholder = _('No IMSI found');
                }
            });

            // Load saved UCI config
            readUciConfig().then(function(config) {
                currentImeiMode = config.imei_mode || 'random';
                currentStaticImei = config.static_imei || '';
                
                var select = document.getElementById('imei-mode-select');
                if (select) select.value = currentImeiMode;
                
                var staticInput = document.getElementById('static-imei-input');
                var warningDiv = document.getElementById('static-imei-warning');
                if (staticInput) {
                    staticInput.value = currentStaticImei;
                    staticInput.style.display = currentImeiMode === 'static' ? 'block' : 'none';
                    
                    // Validate initial static IMEI if present
                    if (currentImeiMode === 'static' && currentStaticImei.length > 0) {
                        const validationResult = validateImei(currentStaticImei);
                        showImeiValidation(staticInput, validationResult);
                    }
                }
                if (warningDiv) {
                    warningDiv.style.display = currentImeiMode === 'static' ? 'block' : 'none';
                }
                
                updateSaveButtonState();
            }).catch(function(err) {
                console.log("Could not load UCI config:", err);
            });
        }, 100);

        return view;
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});