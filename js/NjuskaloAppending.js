//var actionOnDuplicate = 'stop';
//var refreshPattern = 5; //in minutes

var settings = {
    actionOnDuplicate: 'stop',
    email: '',
    refreshInt: 5,
    emailJsUserId: '',
    emailJsTemplateId: ''
}

function AppendElements() {
    $('.UserNav-auth .UserNav-items').append('<li class="UserNav-item"><a href="#" class="item-bit link backupSqlData">Backupiraj podatke</a></li>');
    $('.UserNav-auth .UserNav-items').append('<li class="UserNav-item"><a href="#" class="item-bit link importSqlData">Import</a></li>');
    $('.UserNav-auth .UserNav-items').append('<li class="UserNav-item"><a href="#" class="item-bit link settingsToggle">Postavke</a></li>');
    $('..UserNav-auth .UserNav-items .backupSqlData').click(function () {
        createCsvOfSqlData();
    });
    $.get(chrome.extension.getURL('html/emailJsSetupTutorial.html'))
        .done((function (data) {
            $('body').append(data);
            $('#emailSetupTutorial .closeBtn ').click(function () {
                $('#emailSetupTutorial').removeClass('showing');
                $('.wrap-main').css('opacity', 1);
            });
        }));
    
    $('.UserNav-auth .UserNav-items .settingsToggle').click(function () {
        $('body .content-primary #settingsModal').toggleClass('show');
    });
    //actionOnDuplicate = localStorage.getItem("NjuskaloSavedActionOnDuplicate");
    getSettings();

    $.get(chrome.extension.getURL('html/SettingsModal.html'))
       .done((function (data) {
           $('body .content-primary').prepend(data);

           var btns = $('#settingsModal .button-standard:not(#emailSetupTutorialBtn)');

           for (var i = 0; i < btns.length; i++) {
               var b = $(btns[i]);
               b.click(setActionOnDuplicate);
               //btns[i].addEventListener('click', setActionOnDuplicate);
               if (b.attr('data-action') == settings.actionOnDuplicate) {
                   b.addClass('active');
               }
               else {
                   b.removeClass('active');
               }
           }

           $('#njuskaloEmailForNewAdv').on('blur', function () {
               settings.email = $('#njuskaloEmailForNewAdv').val();
               saveSettings();
           });
           $('#emailjsUserId').on('blur', function () {
               settings.emailJsUserId = $('#emailjsUserId').val();
               saveSettings();
               emailjs.init(emailJSUserId);
           });
           $('#emailjsTemplateId').on('blur', function () {
               settings.emailJsTemplateId = $('#emailjsTemplateId').val();
               saveSettings();
           });
           $('#njuskaloRefreshInt').on('change', function () {
               settings.refreshInt = $('#njuskaloRefreshInt').val();
               saveSettings();
           });

           $('#njuskaloEmailForNewAdv').val(settings.email);
           $('#njuskaloRefreshInt').val(settings.refreshInt);
           $('#emailjsTemplateId').val(settings.emailJsTemplateId);
           $('#emailjsUserId').val(settings.emailJsUserId);

           $('#emailSetupTutorialBtn').click(function () {
               $('#emailSetupTutorial').addClass('showing');
               $('.wrap-main').css('opacity', 0.2);
           });

       }));
    $('.UserNav-auth .UserNav-items .importSqlData').click(function () {
        $('body').append('<div id="importDataModal"><button class="close">close</button><textarea id="advertsCsvData">ADVERTS</textarea><textarea id="priceHistoryCsvData">PRICE HISTORY</textarea><button id="startImport">Pokreni</button></div>');
        $('#importDataModal .close').click(function () {
            $('#importDataModal').remove();
        });

        $('#importDataModal #startImport').click(function () {
            dbase.deleteTables();
            setTimeout(function () {
                dbase.createTables();
            }, 1000);

            setTimeout(function () {
                dbase.insertAdvertsBulk($('#advertsCsvData').val());
                dbase.insertPricesBulk($('#priceHistoryCsvData').val());
                //$('#importDataModal').remove();
            }, 3000);
        });
    });

    
}

function setActionOnDuplicate(e) {
    //console.log('click');
    settings.actionOnDuplicate = e.currentTarget.getAttribute('data-action');
    var btns = $('#settingsModal .button-standard');

    for (var i = 0; i < btns.length; i++) {
        var b = $(btns[i]);
        b.removeClass('active');
    }
    e.currentTarget.className += ' active';
    saveSettings();
    //localStorage.setItem('NjuskaloSavedActionOnDuplicate', actionOnDuplicate);
}

function getSettings() {
    try {
        var obj = localStorage.getItem('NjuskaloExtUserSettings');
        if (obj != null) {
            //console.log(JSON.parse(obj));
            settings = JSON.parse(obj);

            if (settings.emailJsUserId != null) {
                emailjs.init(emailJSUserId);
            }
        }
        else {
            settings = {
                actionOnDuplicate: 'stop',
                email: '',
                refreshInt: 5,
                emailJsUserId: '',
                emailJsTemplateId: ''
            }
        }
    }
    catch (ex) {
        settings = {
            actionOnDuplicate: 'stop',
            email: '',
            refreshInt: 5,
            emailJsUserId: '',
            emailJsTemplateId: ''
        }
    }
    finally {
        saveSettings();
        return settings;
    }
}

function saveSettings() {
    localStorage.setItem('NjuskaloExtUserSettings', JSON.stringify(settings));
    //console.log(settings);
}