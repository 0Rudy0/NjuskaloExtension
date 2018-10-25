var activeOn = [
    "https://www.njuskalo.hr/motori*",
    "https://www.njuskalo.hr/*&categoryId=1148&*",
    "https://www.njuskalo.hr/*&categoryId=12046&*",
    "https://www.njuskalo.hr/sportski-motori*",
    "https://www.njuskalo.hr/cestovni-motori*",
    "https://www.njuskalo.hr/auti*",
    "https://www.njuskalo.hr/rabljeni-auti*",
    "https://www.njuskalo.hr/novi-auti*",
    "https://www.njuskalo.hr/karambolirani-auti*",
    "https://www.njuskalo.hr/prodaja-kuca*",
    "https://www.njuskalo.hr/prodaja-stanova*",
    "https://www.njuskalo.hr/nekretnine*",
    "https://www.njuskalo.hr/novogradnja*",
    "https://www.njuskalo.hr/*&categoryId=9580&*",
    "https://www.njuskalo.hr/*&categoryId=9579&*",
    "https://www.njuskalo.hr/*&categoryId=12404&*",
    "https://www.njuskalo.hr/elektricni-bicikli*"
]

var allImages = {};
var emailsSent = 0;

var messages = {
    insertNewPrice: 'insertNewPrice',
    getPriceHistory: 'getPriceHistory',
    createTables: 'createTables',
    deleteTables: 'deleteTables',
    deleteOldAds: 'deleteOldAds',
    getNumOfOldAds: 'getNumOfOldAds',
    getNumOfAllAds: 'getNumOfAllAds',
    insertAdvertsBulk: 'insertAdvertsBulk',
    insertAdvertPricesBulk: 'insertAdvertPricesBulk'
}

var msgPort;
var transferDataToBckgScript = false;
var recreateTables = true;
var usingDAL = false;
var actionOnDuplicate = '';
var stack = [];
var summary = {
    newAds: [],
    newAds2: {},
    newPrices: [],
    newPrices2: {}
};
//var settings.refreshInt = 5; //in minutes
var startTime = 0;

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
      if (request.action == 'start') {
          console.log('start paging');
          actionOnDuplicate = request.onDuplicate;
          //console.log(actionOnDuplicate);
          sessionStorage.setItem('actionOnDuplicate', actionOnDuplicate);
          if ($('.Pagination-item.Pagination-item--next .Pagination-link').length > 0) {
              sessionStorage.setItem('autoPaging', true);
              $('.Pagination-item.Pagination-item--next .Pagination-link').click();
          }
          else {
              sessionStorage.removeItem('autoPaging');
              setTimeout(function () {
                  chrome.runtime.sendMessage('stop', function (response) {
                      //console.log(response.farewell);
                  });
              }, 300);
          }
      }
      else if (request.action == 'stop') {
          console.log('stop paging');
          sessionStorage.setItem('pauseAutoPaging', true);
          sessionStorage.removeItem('autoPaging');

      }
      else if (request.action == 'toggleScanning') {
          console.log('toggle scanning');

          //return;
          if (sessionStorage.getItem('scanningActive') != null) {
              console.log('zaustavi scanning');

              sessionStorage.removeItem('scanningActive');
              $('#scanningIndicator').remove();
              $('#scanningIndicatorTimer').remove();
          }
          else {
              console.log('pokreni scanning');

              sessionStorage.setItem('scanningActive', true);
              location.reload();
              //setTimeout(function () {
              //}, settings.refreshInt * 60 * 60);
          }
      }
  });

(function () {
    AppendElements();
    if (!isCurrentOnActivePage())
        return;

    //emailjs.init(emailJSUserId);
    //dbase.deleteTables();
    //setTimeout(function () {
    //    dbase.createTables();
    //}, 1500);

    if (sessionStorage.getItem('scanningActive') != null) {

        setTimeout(function () {
            location.reload();
        }, settings.refreshInt * 1000 * 60);

        $('body').append('<div id="scanningIndicator">Scanning every <br>' + settings.refreshInt + ' minutes</div>');
        $('body').append('<div id="scanningIndicatorTimer"></div>');

        startTime = (new Date()).getTime();
        setInterval(function () {
            var diffSeconds = ((new Date()).getTime() - startTime) / 1000;
            var remaining = (settings.refreshInt * 60) - diffSeconds;
            if (remaining < 0.1) {
                $('#scanningIndicatorTimer').html('Refreshing...');
            }
            else {
                $('#scanningIndicatorTimer').html('Next refresh in <br>' + formatFloat(remaining, 0) + ' sec');
            }
        }, 1000);

    }

    dbase.createTables();



    sessionStorage.removeItem('pauseAutoPaging');
    if (sessionStorage.getItem("autoPaging")) {
        actionOnDuplicate = sessionStorage.getItem('actionOnDuplicate');
        setTimeout(function () {
            if ($('.Pagination-item.Pagination-item--next .Pagination-link').length > 0) {
                if (!sessionStorage.getItem('pauseAutoPaging')) {
                    $('.Pagination-item.Pagination-item--next .Pagination-link').click();
                }
            }
            else {
                sessionStorage.removeItem('autoPaging');

            }
        }, 5500);
    }
    if ($('.Pagination-item.Pagination-item--next .Pagination-link').length == 0) {
        chrome.runtime.sendMessage('stop', function (response) {
            //console.log(response.farewell);
        });
    }

    if (usingDAL) {
        msgPort = chrome.runtime.connect({ name: 'DAL' });
        msgPort.onMessage.addListener(function (msg) {
            if (msg.cmd == 'onGetHistory') {
                msg.data.results.rows.length = msg.data.results.length;
                onGetHistory.apply(msg.data.domItem, [null, msg.data.results]);
            }
        });
        if (transferDataToBckgScript) {
            dbase.getAllAdverts();
            dbase.getAllAdvertPrices();
        }
        if (recreateTables) {
            msgPort.postMessage({ cmd: messages.deleteTables });
        }
    }
    if ($('.EntityListFilter.block-standard').length == 0) {
        //gleda se jedan oglas
        formatMileageAddHP();
        var itemId = window.location.href.substring(window.location.href.lastIndexOf('-') + 1);

        var prices = getPrices($('body')[0]);
        if (usingDAL) {
            msgPort.postMessage({
                cmd: messages.insertNewPrice,
                data: {
                    itemId: itemId,
                    priceHRK: prices.priceHRK,
                    priceEUR: prices.priceEUR
                }
            });
            msgPort.postMessage({
                cmd: messages.getPriceHistory,
                data: { itemId: itemId, domItem: { details: true } }
            })
        }
        else {
            dbase.insertNewPrice(itemId, prices.priceHRK, prices.priceEUR);
            dbase.getPriceHistory(itemId, { details: true });
        }

        scrollonImageClick();
    }
    else {
        //gleda se lista oglasa
        var items = getEntityElements();
        $.each(items, function (index, value) {
            stack.push(1);
            var isLast = false;
            if (index == items.length - 1) {
                isLast = true;
                //console.log('stack: ' + stack.length);
            }
            formatMileageList($(value));
            setTimeout(function () {
                var temp = {
                    el: $(value),
                    isLast: isLast
                }
                setAdditionalInfo.apply(temp);
            }, index * 1);
            insertChart($(value));
        });
        addRemoveButtons();
        $('.EntityList-item .entity-thumbnail a').click(function (e) {
            e.preventDefault();
            var imgs = allImages[this.href.substring(this.href.lastIndexOf('-') + 1)];

            $.get(chrome.extension.getURL('html/modalImages.html'))
				.done(function (data) {
				    $('body').append(data);
				    var html = '';
				    for (var i = 0; i < imgs.imgs.length; i++) {

				        html += '<div><span class="helper"></span>' +
							'<img data-u="image" src="' + imgs.imgs[i] + '" />' +
							'<img data-u="thumb" src="' + imgs.thumbs[i] + '" />' +
							'</div>';
				    }
				    $('#slidesHolder').html(html);

				    $('#closeBtn').click(function () {
				        $('#jssor_1').animate(
							{ opacity: 0 },
							200,
							function () {
							    $("#jssor_1").remove();
							    $("#overlay").remove();
							});
				        //$("#jssor_1").remove();
				    });

				    $("#overlay").click(function () {
				        $('#jssor_1').animate(
							{ opacity: 0 },
							200,
							function () {
							    $("#jssor_1").remove();
							    $("#overlay").remove();
							});
				    })
				    $JssorSlider$("jssor_1", jssor_1_options);
				    //setTimeout(function () {
				    //}, 100);
				});
        });

        $.get(chrome.extension.getURL('html/popupInfo.html'))
				.done(function (data) {
				    $('body').append(data);

				});
    }

    setTimeout(function () {
        $('iframe').remove();
    }, 6000);
})();

//#region only details

function scrollonImageClick() {
    $($('.Gallery-action.Gallery-action--zoom.Gallery-genericZoomAction')[0]).click(function () {
        setTimeout(function () {
            window.scrollTo(0, $('#base-entity-gallery-tab').offset().top);
            setTimeout(function () {
                window.scrollTo(0, $('#base-entity-gallery-tab').offset().top);
                setTimeout(function () {
                    window.scrollTo(0, $('#base-entity-gallery-tab').offset().top);
                    setTimeout(function () {
                        window.scrollTo(0, $('#base-entity-gallery-tab').offset().top);
                        setTimeout(function () {
                            window.scrollTo(0, $('#base-entity-gallery-tab').offset().top);
                        }, 100);
                    }, 100);
                }, 100);
            }, 100);
        }, 100);
    });
}

function formatMileageAddHP(that) {
    var rows = $('.table-summary tbody tr');
    var mileage = 0;
    for (var j = 0; j < rows.length; j++) {
        if ($($(rows[j]).find('th'))[0].innerHTML == 'Prijeđeni kilometri:') {
            mileage = parseInt($($(rows[j]).find('td'))[0].innerHTML.replace('<abbr title="kilometri">km</abbr>', ''));
            $($(rows[j]).find('td'))[0].innerHTML = $($(rows[j]).find('td'))[0].innerHTML.replace(mileage, formatFloat(mileage, 0));
        }
        else if ($($(rows[j]).find('th'))[0].innerHTML == 'Snaga motora:') {
            var power = parseInt($($(rows[j]).find('td'))[0].innerHTML.replace('<abbr title="kilovati">kWh</abbr>', ''));
            $($(rows[j]).find('td'))[0].innerHTML = $($(rows[j]).find('td'))[0].innerHTML = power + ' <abbr title="kilovati">kWh</abbr> (' + Math.ceil(power * 1.3428) + ' hp)';
        }
    }
}

function insertPriceHistoryText(priceHistory) {
    //return;
    jQuery('<table/>', {
        id: 'priceListTable',
        text: ''
    }).appendTo($('#priceHistoryText'));

    var tableContent = '<thead><tr><td>Datum</td><td>Cijena HRK</td><td>Diff HRK</td><td>Cijena EUR</td><td>Diff EUR</td></tr></thead>';
    //$('#priceListTable').css('width', '100%');

    for (var i = priceHistory.length - 2; i >= 0; i--) {
        var priceHrk = formatFloat(priceHistory[i].priceHRK, 0) + ' HRK';
        var priceEur = formatFloat(priceHistory[i].priceEUR, 0) + ' €';
        var priceHrkDiff = i > -1 ? formatFloat((priceHistory[i + 1].priceHRK - priceHistory[i].priceHRK), 0) + ' kn' : 0;
        var priceEurDiff = i > -1 ? formatFloat((priceHistory[i + 1].priceEUR - priceHistory[i].priceEUR)) + ' €' : 0;
        tableContent += '<tr><td>' + new Date(priceHistory[i].date).toLocaleDateString('hr') + '</td><td>' + priceHrk + '</td><td>' + priceHrkDiff + '</td><td>' + priceEur + '</td><td>' + priceEurDiff + '</td><tr>';
    }
    $('#priceListTable').html(tableContent);
    //$('#priceListTable td').css('border', '1px solid black');
    //$('#priceListTable td').css('padding', '4px');
    //$('#priceListTable thead td').css('text-align', 'center');
    //$('#priceListTable tbody td').css('text-align', 'right');
    //$('#priceListTable tbody td').css('font-family', 'consolas');
}

function insertPriceHistoryChart(priceHistory) {
    jQuery('<div/>', {
        id: 'chart_div',
        text: ''
    }).appendTo($('#priceHistoryChart'));
    //$('#chart_div').css('width', '100%');
    //$('#chart_div').css('height', '100%');
    //$('#chart_div').css('box-shadow', '2px 2px 7px 0px rgba(0,0,0,0.75');

    drawChart('#chart_div', priceHistory);
}

function insertDateFirstViewed(date) {
    var elapsedDays = Math.floor(((new Date().getTime() - new Date(date).getTime()) / 86400000));
    var elapsedDaysString = '(prije ' + elapsedDays + ' dana)';
    $('.base-entity-meta ul.meta-items li.meta-item:nth-child(2) span.label').innerHTML = 'Obnovljen: ';
    if (elapsedDays == 0) {
        jQuery('<li/>', {
            class: 'date date--full',
            text: 'Novi oglas'
        }).appendTo($('.base-entity-meta ul.meta-items'));
    }
    else {
        jQuery('<li/>', {
            class: 'date date--full',
            text: 'Prvi puta viđen: ' + new Date(date).toLocaleDateString('hr') + ' ' + elapsedDaysString
        }).appendTo($('.base-entity-meta ul.meta-items'));
    }
}

//#endregion

//#region only list

function fixLayoutList() {
    //$('.block-standard.EntityListBlock').hide();
    //$('.js-EntityList--ListItemFeaturedStore').hide();
    //$('#auxDataTogglerButton').trigger('click');
    //$('.FlexEmbed').hide();
    //setTimeout(function () {
    //	$('body').scrollTop(150);
    //}, 500);
}

function getEntityElements() {
    var items = $('.EntityList--Regular ul.EntityList-items>li.EntityList-item--Regular');
    var vauItems = $('.EntityList--VauVau ul.EntityList-items>li.EntityList-item--VauVau');
    var vauItemsDuplicate = $('.EntityList--Regular ul.EntityList-items>li.EntityList-item--VauVau');
    for (var i = 0; i < vauItemsDuplicate.length; i++) {
        var found = false;
        for (var j = 0; j < vauItems.length; j++) {
            //console.log(JSON.parse($(vauItemsDuplicate[i])[0].attributes["data-options"].value).id);
            if (JSON.parse($(vauItemsDuplicate[i])[0].attributes["data-options"].value).id ==
				JSON.parse($(vauItems[j])[0].attributes["data-options"].value).id) {
                $(vauItemsDuplicate[i]).hide();
                found = true;
                break;
            }
            //$(vauItems[j]).removeClass('EntityList-item--VauVau');
            //$(vauItems[j]).removeClass('js-EntityList-item--VauVau');
            //$(vauItems[j]).addClass('EntityList-item--Regular');
            //$(vauItems[j]).addClass('js-EntityList-item--Regular');
        }
        if (!found) {
            items.push(vauItemsDuplicate[i]);
        }
    }
    for (i = 0; i < vauItems.length; i++) {
        items.push(vauItems[i]);
    }

    //for (var i = 0; i < items.length; i++) {
    //	console.log(items[i]);
    //}

    return items;
}

function setAdditionalInfo(that, isLast) {
    //var el = this;
    var currID = JSON.parse(this.el[0].attributes["data-options"].value).id;
    var prices = getPrices(this.el[0]);
    var currTitle = $(this.el).find('h3.entity-title a').html();
    //console.log(currTitle);
    //var images = getImages();

    setLoadingDiv(this.el, currID);

    if (usingDAL) {
        msgPort.postMessage({
            cmd: messages.insertNewPrice,
            data: {
                itemId: currID,
                priceHRK: prices.priceHRK,
                priceEUR: prices.priceEUR
            }
        });

        msgPort.postMessage({
            cmd: messages.getPriceHistory,
            data: { itemId: currID, domItem: this.el }
        })
    }

    else {
        this.el.isLast = this.isLast;
        //dbase.getPriceHistory(currID, this.el);
    }

    var link = this.el.find('h3 a')[0].href;
    this.el.url = link;
    $.ajax({
        url: link,
        async: true,
        cache: true,
        success: getAdditionalItemInfoCallback.bind(this.el),
        //success: function (response) {
        //	//var images = getImages(response);
        //},
        error: function (response) {
            //that.find('.loadingDiv').hide();
            console.log('error');
        }
    });
}

function checkBeforeMerge(newAdvert, oldAdvert, temp) {
    //console.log('check before merge ' + newAdvert.advertId);
    if (oldAdvert == null && newAdvert == null) {
        //console.log(temp);
    }
    else if (oldAdvert == null && newAdvert != null) {
        //console.log('send new email ' + newAdvert.advertId);
        sendNewAdvEmailNotification(newAdvert);
    }
    else if (newAdvert != null && oldAdvert != null) {
        console.log('duplicate advert ' + newAdvert.advertId);
        sendNewAdvEmailNotification(newAdvert);

        //console.log('found duplicate');
        $.get(chrome.extension.getURL('html/mergeModal.html'))
        .done((function (data) {
            data = data.replace('{modalID}', 'mergeModal' + oldAdvert.advertId);
            var mId = '#mergeModal' + oldAdvert.advertId;
            $('body').append(data);
            $(mId).show();
            var title = oldAdvert.title;
            while (title.indexOf(';') > 0) {
                title = title.replace(';', '<br/>');
            }
            $(mId + ' .leftContent h3').html($(mId + ' .leftContent h3').html() + ' (ID: ' + oldAdvert.advertId + ')');
            $(mId + ' .leftContent .title').html(title);
            $(mId + ' .leftContent a.username').html(oldAdvert.username);
            $(mId + ' .leftContent a.username').attr('href', 'http://www.njuskalo.hr' + oldAdvert.username);
            $(mId + ' .leftContent p.description').html(oldAdvert.mainDesc);
            for (var i = 0; i < oldAdvert.priceHistory.length; i++) {
                var ph = oldAdvert.priceHistory[i];
                var priceHrk = formatFloat(ph.priceHRK, 0) + ' HRK';
                var priceEur = formatFloat(ph.priceEUR, 0) + ' €';
                $(mId + ' .leftContent ul.price-history-merge').append('<li><b>' +
                    new Date(ph.date).toLocaleDateString('hr') + '</b> - ' + priceHrk + ' ; ' + priceEur + '</li>');
                //console.log(priceHrk);
            }
            $(mId + ' .leftContent p.dateFirstViewed').html(oldAdvert.dateFirstViewed.toLocaleDateString('hr'));
            $(mId + ' .leftContent p.dateLastViewed').html(oldAdvert.dateLastViewed.toLocaleDateString('hr'));

            title = newAdvert.title;
            while (title.indexOf(';') > 0) {
                title = title.replace(';', '<br/>');
            }
            while (title.indexOf('-') > 0) {
                title = title.replace('-', '<br/>');
            }

            $(mId + ' .rightContent h3').html($(mId + ' .rightContent h3').html() + ' (ID: ' + newAdvert.advertId + ')');
            $(mId + ' .rightContent .title').html(title);
            $(mId + ' .rightContent a.newAdvLink').attr('href', newAdvert.url)
            $(mId + ' .rightContent a.username').html(newAdvert.username);
            $(mId + ' .rightContent a.username').attr('href', 'http://www.njuskalo.hr' + newAdvert.username);
            $(mId + ' .rightContent p.description').html(newAdvert.mainDesc);
            var priceHrk = formatFloat(newAdvert.priceHRK, 0) + ' HRK';
            var priceEur = formatFloat(newAdvert.priceEUR, 0) + ' €';
            $(mId + ' .rightContent ul.price-history-merge').html('<li>' + priceHrk + ' ; ' + priceEur + '</li>');

            if (sessionStorage.getItem('autoPaging') == "true") {
                //console.log(actionOnDuplicate);
                switch (actionOnDuplicate) {
                    case 'stop':
                        sessionStorage.setItem('pauseAutoPaging', true);
                        console.log('auto paging - pause because of the duplicate');
                        break;
                    case 'insertAsNew':
                        console.log('auto paging - inserting as new');

                        dbase.insertNewAdvert(newAdvert.advertId, newAdvert.priceHRK, newAdvert.priceEUR, newAdvert.title, newAdvert.mainDesc, newAdvert.username);
                        if (sessionStorage.getItem("autoPaging") && $('.Pagination-item.Pagination-item--next .Pagination-link').length > 0) {
                            setTimeout(function () {
                                $('.Pagination-item.Pagination-item--next .Pagination-link').click();
                            }, 100);
                        }
                        break;
                    case 'merge':
                        console.log('auto paging - auto merging');

                        dbase.mergeAdverts(oldAdvert.advertId, newAdvert.advertId, newAdvert.priceHRK, newAdvert.priceEUR, newAdvert.title, newAdvert.mainDesc, newAdvert.username);
                        setTimeout(function () {
                            //location.reload();
                        }, 100);
                        break;
                }
            }

            $(mId + ' .acceptMerge').click(function () {
                $(mId).hide();
                dbase.mergeAdverts(oldAdvert.advertId, newAdvert.advertId, newAdvert.priceHRK, newAdvert.priceEUR, newAdvert.title, newAdvert.mainDesc, newAdvert.username);
                setTimeout(function () {
                    sessionStorage.removeItem('pauseAutoPaging');
                    location.reload();
                }, 100);
            });
            $(mId + ' .cancelMerge').click(function () {
                $(mId).hide();
                sessionStorage.removeItem('pauseAutoPaging');
                dbase.insertNewAdvert(newAdvert.advertId, newAdvert.priceHRK, newAdvert.priceEUR, newAdvert.title, newAdvert.mainDesc, newAdvert.username);

                if (sessionStorage.getItem("autoPaging") && $('.Pagination-item.Pagination-item--next .Pagination-link').length > 0) {
                    setTimeout(function () {
                        $('.Pagination-item.Pagination-item--next .Pagination-link').click();
                    }, 100);
                }
            });
            $(mId + ' .closeBtn').click(function () {
                $(mId).hide();
                sessionStorage.removeItem('pauseAutoPaging');

                if (sessionStorage.getItem("autoPaging") && $('.Pagination-item.Pagination-item--next .Pagination-link').length > 0) {
                    setTimeout(function () {
                        $('.Pagination-item.Pagination-item--next .Pagination-link').click();
                    }, 100);
                }
            });
        }));
    }
}

function sendNewAdvEmailNotification(newAdvert) {
    if (sessionStorage.getItem('scanningActive') != null && emailsSent > -1) {
        newAdvert.thumbnail = $('li[data-options="{\\"hasCompare\\":true,\\"id\\":' + newAdvert.advertId + '}"] .entity-thumbnail a>img')[0].dataset.src.substring(2);

        var parts = newAdvert.title.split(';');
        var subject = "Novi oglas - " + parts[0] + ' ' + parts[1] + ' ' + parts[3] + ' (' + formatFloat (newAdvert.priceHRK, 0) + ' kn)';
        while (newAdvert.title.indexOf(";") > -1) {
            newAdvert.title = newAdvert.title.replace(";", " - ");
        }

        //console.log(newAdvert.advertId);
        //console.log(newAdvert.title);
        //console.log(newAdvert.thumbnail);
        var body = "<img src=\"" + newAdvert.thumbnail + "\" alt=\"thumbnail\">";
        body += "<br>";
        body += "<br>";
        body += "<a href=\"" + newAdvert.url + "\" target=\"_blank\" style=\"font-size:12pt;\">" + newAdvert.title + "</a>";
        body += "<br>";
        body += "<p style=\"color:black;\">" + newAdvert.mainDesc + "</p>";
        body += "<b>";
        body += formatFloat(newAdvert.priceHRK, 0) + " kn</b>";
        body += "<b>";
        body += formatFloat(newAdvert.priceEUR, 0) + " €</b>";
        //return;

        if (settings == null)
            settings = getSettings();

        if (settings.email != null && settings.email.length > 0 &&
            settings.emailJsTemplateId != null && settings.emailJsTemplateId.length > 0 &&
            settings.emailJsUserId != null && settings.emailJsUserId.length > 0) {

            //sendWithSendGrid(subject, body, 'Njuskalo@sendgrid.com', settings.email);
            //sendWithMailgun(subject, body, emailSender, settings.email);
            //sendWithElastic(subject, body, 'postmaster@codius.co', settings.email)
            console.log('sending email...');
            sendWithEmailJS(subject, body, settings.email);
            emailsSent++;
        }
        else {
            alert('Podaci za slanje email nedostaju');
        }
    }
    else {
        //console.log('did not send email because ' + emailsSent);
    }
}

function sendWithSendGrid(subject, body, emailSender, receiver) {
    var data = JSON.stringify({
        "personalizations": [
          {
              "to": [
                {
                    "email": receiver,
                    "name": "John Doe"
                }
              ],
              "subject": subject
          }
        ],
        "from": {
            "email": emailSender,
            "name": "Sam Smith"
        },
        "reply_to": {
            "email": emailSender,
            "name": "Sam Smith"
        },
        "content": [
          {
              "type": "text/plain",
              "value": body
          }
        ]
    });

    var emailSettings = {
        "async": true,
        "crossDomain": true,
        "url": "https://api.sendgrid.com/v3/mail/send",
        "method": "POST",
        "headers": {
            "authorization": "Bearer " + sendGridApiKey,
            "content-type": "application/json"
        },
        "processData": false,
        "data": data
    }

    //$.ajax(emailSettings).done(function (response) {
    //    console.log(response);
    //});

    //$.ajax({
    //    type: "POST",
    //    url: "https://api.sendgrid.com/v3/mail/send",
    //    headers: {
    //        'Authorization': 'Bearer ' + sendGridApiKey
    //    },
    //    data: {
    //        'to': receiver,
    //        'from': emailSender,
    //        'subject': subject,
    //        'html': body,
    //    }
    //}).done(function (response) {
    //    console.log("Email sent");
    //});
}

function sendWithMailgun(subject, body, emailSender, receiver) {
    $.ajax({
        type: "POST",
        url: 'https://api.mailgun.net/v3/sandboxeb0dfefbe39f4aa1930b96995b957258.mailgun.org/messages',
        username: 'api',
        dataType: 'text',
        //xhrFields: {
        //    withCredentials: true
        //},
        headers: {
            //'accept': 'application/json',
            'content-type': 'application/x-www-form-urlencoded',
            //"Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,PATCH,OPTIONS",
            //"Access-Control-Allow-Headers": "Authorization",
            //"Authorization": "Basic " + btoa(mailgunApiKey)
        },
        password: mailgunPassword,
        data: {
            "html": body,
            "subject": subject,
            "from": emailSender,
            "to": '<' + receiver + '>'
        },
        //beforeSend: function (xhr) {
        //    xhr.setRequestHeader("Authorization", "Basic " + btoa(mailgunApiKey));
        //},
        success: function (a, b, c) {
            console.log('mail sent: ', b);
        }.bind(this),
        error: function (xhr, status, errText) { console.log('mail sent failed: ', xhr.responseText); }
    })
}

function sendWithElastic(subject, body, from, to) {
    Email.send(from,
        to,
        subject,
        'test 2 email',
        elasticSmtp,
        elasticEmail,
        elasticPass,
        function done(message) { alert("sent to " + to) });
}

function sendWithEmailJS(subject, body, to) {

    var service_id = 'default_service';
    var template_id = settings.emailJsTemplateId;
    var template_params = {
        subject: subject,
        emailTo: to,
        message: body
    };

    try {
        emailjs.send(service_id, template_id, template_params);  
    }
    catch (ex) {
        alert('error sending email');
    }
}

function setLoadingDiv(element, itemId) {
    jQuery('<div/>', {
        id: 'loadingDiv' + itemId,
        class: 'loadingDiv',
        text: ''
    }).appendTo(element.find('.entity-description')[0]);
    //jQuery('<div/>', {
    //	id: 'loadingDiv' + itemId,
    //	class: 'loadingDivv Preloader Preloader--center',
    //	text: ''
    //}).appendTo(element.find('.entity-description')[0]);

    //jQuery('<div/>', {
    //	id: 'loadingDivInner' + itemId,
    //	class: 'Preloader-inner',
    //	text: ''
    //}).appendTo(element.find('#loadingDiv' + itemId)[0]);

    //$(element.find('.loadingDiv')).css('width', '100px');
    //$(element.find('.loadingDiv')).css('height', '50px');
    //$(element.find('.loadingDiv')).css('float', 'right');
    //$(element.find('.loadingDiv')).css('position', 'relative');
    //$(element.find('.loadingDiv')).css('margin-right', '50px');
    //$(element.find('.loadingDiv')).css('background-size', '100px');
    //$(element.find('.loadingDiv')).css('background-position', '50% 50%');
    //$(element.find('.loadingDiv')).css('background-repeat', 'no-repeat');
    //$(element.find('.loadingDiv')).css('background-image', 'url("http://www.iett.gov.tr/images/loading.gif")');

    $(element.find('.entity-description-main')[0]).css('float', 'left');
}

function formatMileageList(that) {
    var element = $($(that[0]).find(".entity-description-main")[0]);
    var mileage = parseInt(element.html().substring(0, element.html().indexOf("<br>")).replace('Rabljeno vozilo, ', '').replace(' km', '').trim());
    if (isNaN(mileage)) {
        mileage = parseInt(element.html().substring(0, element.html().indexOf("<br>")).replace('Testno vozilo, ', '').replace(' km', '').trim());
        if (isNaN(mileage)) {
            mileage = parseInt(element.html().substring(0, element.html().indexOf("<br>")).replace('Rabljeni motor, ', '').replace(' km', '').trim());
            if (isNaN(mileage)) {
                return;
            }
        }
    }
    element.html(element.html().replace(mileage, formatFloat(mileage, 0)));
}

function getAdditionalItemInfoCallback(response) {
    this.find('.loadingDiv').hide();
    var images = getImages(response);

    allImages[JSON.parse(this[0].attributes["data-options"].value).id] = images;

    var username = $(response).find('.Profile-wrapUsername a').attr('href');
    //return;
    var kilometri = "Prijeđeni kilometri: ";
    var motor = 'Motor: ';
    var rows = $(response).find('.table-summary tbody tr');
    var sideDescItems = [];
    var concatTitle = '';
    for (var j = 0; j < rows.length; j++) {
        //OSOBNI AUTOMOBILI
        if ($('.breadcrumb-items li:nth-child(4) a.link').html().indexOf('Osobni automobili') > -1) {
            if ($($(rows[j]).find('th'))[0].innerHTML == 'Marka automobila:') {
                concatTitle += $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Model automobila:') {
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Tip automobila:') {
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Godina modela:') {
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Motor:') {
                motor += $($(rows[j]).find('td'))[0].innerHTML + ' - ';
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Snaga motora:') {
                motor += $($(rows[j]).find('td'))[0].innerHTML.replace(' <abbr title="kilovati">kW</abbr>', ' kWh');
                var toHorsePower = parseInt($($(rows[j]).find('td'))[0].innerHTML.replace(' <abbr title="kilovati">kW</abbr>', '')) * 1.3428;
                sideDescItems.push(motor + ' (' + Math.ceil(toHorsePower) + ' hp)');

                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML.replace(' <abbr title="kilovati">kW</abbr>', 'kWh');
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Mjenjač:') {
                sideDescItems.push('Mjenjač: ' + $($(rows[j]).find('td'))[0].innerHTML);
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Vlasnik:') {
                sideDescItems.push('Vlasnik: ' + $($(rows[j]).find('td'))[0].innerHTML);
            }


        }

            //MOTORI
        else if ($('.breadcrumb-items li:nth-child(4) a.link').html().indexOf('Motocikli / Motori') > -1) {
            if ($($(rows[j]).find('th'))[0].innerHTML == 'Marka:') {
                concatTitle += $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Model:') {
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Snaga motora:') {
                motor += $($(rows[j]).find('td'))[0].innerHTML.replace(' <abbr title="kilovati">kW</abbr>', ' kWh');
                var toHorsePower = parseInt($($(rows[j]).find('td'))[0].innerHTML.replace(' <abbr title="kilovati">kW</abbr>', '')) * 1.3428;
                sideDescItems.push(motor + ' (' + Math.ceil(toHorsePower) + ' hp)');

                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML.replace(' <abbr title="kilovati">kW</abbr>', 'kWh');
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Boja:') {
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Vlasnik:') {
                sideDescItems.push('Vlasnik: ' + $($(rows[j]).find('td'))[0].innerText);
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Godina proizvodnje:') {
                concatTitle += ';' + $($(rows[j]).find('td time'))[0].innerHTML;
            }
        }

            //STAMBENO
        else if ($('.breadcrumb-items li:nth-child(3) a.link').html().indexOf('Nekretnine') > -1) {
            //if ($($(rows[j]).find('th'))[0].innerHTML == 'Županija:') {
            //	concatTitle += $($(rows[j]).find('td'))[0].innerHTML;
            //}
            if ($($(rows[j]).find('th'))[0].innerHTML == 'Grad/Općina:') {
                concatTitle += $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Naselje:') {
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Tip stana:') {
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Tip kuće:') {
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Broj etaža:') {
                sideDescItems.push('Broj etaža: ' + $($(rows[j]).find('td'))[0].innerText);
                //concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Broj soba:') {
                sideDescItems.push('Broj soba: ' + $($(rows[j]).find('td'))[0].innerText);
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Kat:') {
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Šifra objekta:') {
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Stambena površina:') {
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
            }
            else if ($($(rows[j]).find('th'))[0].innerHTML == 'Godina izgradnje:') {
                sideDescItems.push('Godina izgradnje: ' + $($(rows[j]).find('td'))[0].innerText);
                concatTitle += ';' + $($(rows[j]).find('td'))[0].innerText;
            }

        }

    }

    if ($(response).find('.Profile-wrapUsername>a.link')[0].innerHTML.trim() == 'Posjetite ovu Njuškalo trgovinu') {
        sideDescItems.push('Njuskalo trgovina');
    }
    else {
        sideDescItems.push('Privatna osoba');
    }

    $(this.find('.entity-description-main')[0]).css('float', 'left');
    jQuery('<ul/>', {
        id: 'entity-description-rest',
        text: ''
    }).appendTo($(this.find('.entity-description')[0]));

    for (var k = 0; k < sideDescItems.length; k++) {
        var text = sideDescItems[k];
        if (text == 'Privatna osoba') {
            text = '<strong>' + text + '</strong>';
        }
        text = '<li>' + text + '</li>';
        //jQuery('<li/>', {
        //	text: sideDescItems[k]
        //}).appendTo($(this.find('#entity-description-rest')[0]));
        $(text).appendTo($(this.find('#entity-description-rest')[0]));
    }

    $(this.find('#entity-description-rest')[0]).css('float', 'right');
    $(this.find('#entity-description-rest')[0]).css('padding-right', '50px');

    //insert new price
    var currID = JSON.parse(this[0].attributes["data-options"].value).id;
    var prices = getPrices(this);
    var mainDesc = $(this).find('.entity-description-main').html().trim();

    if ($('.breadcrumb-items li:nth-child(4) a.link').html() == 'Osobni automobili') {
        var extraInfo = $(response).find('.passage-standard h3');
        var exit = false;
        for (var i = 0; i < extraInfo.length; i++) {
            if ($(extraInfo[i]).html() == 'Dodatni podaci:') {
                var lis = $(extraInfo[i]).next().find('li');
                for (var k = 0; k < lis.length; k++) {
                    if ($(lis[k]).html().indexOf('Boja') > -1) {
                        concatTitle += ';' + $(lis[k]).html().replace('Boja: ', '');
                        //console.log($(lis[j]).html().replace('Boja: ', ''));
                        exit = true;
                        break;;
                    }
                }
                if (exit) {
                    break;
                }
            }
        }
    }

    dbase.insertNewPrice(currID, prices.priceHRK, prices.priceEUR, concatTitle, mainDesc, username, this.url, checkBeforeMerge);
    setTimeout(getPrHistory.bind({
        currID: currID,
        el: this
    }), 100);
    //dbase.getPriceHistory(currID, this.el);
}

function getPrHistory() {
    dbase.getPriceHistory(this.currID, this.el);
}


function embedPriceHistory(jQueryElement, priceHistory, itemId) {
    jQuery('<li/>', {
        id: 'historyBtnList' + itemId,
        class: 'tool-item historyBtnList',
        text: ''
    }).appendTo(jQueryElement.find('.tool-items')[0]);
    jQuery('<a/>', {
        id: 'historyBtn' + itemId,
        class: 'icon-item tool historyBtn',
        text: ''
    }).appendTo(jQueryElement.find('#historyBtnList' + itemId)[0]);
    jQuery('<span/>', {
        id: 'historyBtnIcon' + itemId,
        //class: 'icon icon--action icon--xs icon--data',
        text: priceHistory.length
    }).appendTo(jQueryElement.find('#historyBtn' + itemId)[0]);

    $('#historyBtnList' + itemId).click(function () {
        $('#entityPrices' + itemId + ' .price-history').toggle();
        $('#chart_div' + itemId).toggle();
        drawChart('#chart_div' + itemId, priceHistory);
        $('#entityPrices' + itemId + ' .price-items:nth-child(1)').toggle();
        $('#entityPrices' + itemId).parent().parent().toggleClass('expanded');
    });
    $('#historyBtnList' + itemId).css('background-color', '#99cc00');
    $('#historyBtnList' + itemId).css('border-radius', '4px');
    $('#historyBtnList' + itemId).css('cursor', 'pointer');

    $(jQueryElement.find('.entity-prices')[0]).attr('id', 'entityPrices' + itemId);
    for (var i = priceHistory.length - 1; i >= 0; i--) {
        var priceHrk = formatFloat(priceHistory[i].priceHRK, 0) + ' HRK';
        var priceEur = formatFloat(priceHistory[i].priceEUR, 0) + ' €';
        var priceHrkDiff = i > 0 ? (priceHistory[i].priceHRK - priceHistory[i - 1].priceHRK) + ' kn' : 0;
        var priceEurDiff = i > 0 ? (priceHistory[i].priceEUR - priceHistory[i - 1].priceEUR) + ' €' : 0;

        jQuery('<ul/>', {
            id: 'priceList' + i,
            class: 'price-items cf price-history',
            text: ''
        }).appendTo(jQueryElement.find('.entity-prices')[0]);
        jQuery('<li/>', {
            id: 'priceListItemHrk' + i,
            class: 'price-item',
            text: ''
        }).appendTo(jQueryElement.find('#priceList' + i)[0]);
        jQuery('<li/>', {
            id: 'priceListItemEur' + i,
            class: 'price-item',
            text: ''
        }).appendTo(jQueryElement.find('#priceList' + i)[0]);
        jQuery('<span/>', {
            id: 'priceListItemContentHrk' + i,
            class: 'price price--hrk',
            title: priceHrkDiff,
            text: priceHrk
        }).appendTo(jQueryElement.find('#priceListItemHrk' + i)[0]);
        jQuery('<span/>', {
            id: 'priceListItemContentEur' + i,
            class: 'price price-eur',
            title: priceEurDiff,
            text: priceEur
        }).appendTo(jQueryElement.find('#priceListItemEur' + i)[0]);

        jQuery('<li/>', {
            id: 'priceListItemDate' + i,
            class: 'price-item price-item-date',
            text: (new Date(priceHistory[i].date)).toLocaleDateString('hr')
        }).appendTo(jQueryElement.find('#priceList' + i)[0]);

        if ((new Date(priceHistory[i].date)).toLocaleDateString('hr') == (new Date()).toLocaleDateString('hr')) {
            $('#historyBtnList' + itemId).css('background-color', '#cc002c');
            $('#historyBtnList' + itemId).addClass('newPrice');
            summary.newPrices.push(JSON.parse(jQueryElement.attr('data-options')).id);
            //summary.newPrices2[JSON.parse(jQueryElement.attr('data-options')).id] = true;
            summary.newPrices2[JSON.parse(jQueryElement.attr('data-options')).id] = jQueryElement[0].innerText;
            //console.log("new price: " + JSON.parse(jQueryElement.attr('data-options')).id);
        }

        if (i == priceHistory.length - 1) {
            $(jQueryElement.find('#priceList' + i)).css('font-weight', 'bold');
            $(jQueryElement.find('#priceList' + i + ' li')).css('color', 'black');
            $(jQueryElement.find('#priceList' + i)).css('font-size', '12px');
            $(jQueryElement.find('#priceList' + i)).css('margin-bottom', '5px');
        }
        $(jQueryElement.find('#priceList' + i + ' li')).css('width', '80px');
    }

    //$('#entityPrices' + itemId + ' li').css('width', '100px');

    //$('.price-history').css('font-size', '11px');
    //$('.price-history').css('color', 'gray');
    $('.price-history').css('display', 'none');
    //$('.price-item-date').css('padding-top', '3px');
    //$('.price-items.cf:first-child').css('margin-bottom', '5px');

    if (priceHistory.length > 1) {
        $(jQueryElement.find('.price-items.cf .price--hrk')[0]).attr('title', (priceHistory[priceHistory.length - 1].priceHRK - priceHistory[priceHistory.length - 2].priceHRK) + ' kn');
        if ($(jQueryElement.find('.price-items.cf .price--eur').length > 0))
            $(jQueryElement.find('.price-items.cf .price--eur')[0]).attr('title', (priceHistory[priceHistory.length - 1].priceEUR - priceHistory[priceHistory.length - 2].priceEUR) + ' €');
    }
}

function embedDateFirstViewed(jQueryElement, priceHistory) {
    var elapsedDays = 0;
    if (priceHistory.length > 0) {
        elapsedDays = Math.floor((new Date().getTime() - new Date(priceHistory[0].dateFirstViewed).getTime()) / 86400000);
    }
    var elapsedDaysString = '(prije ' + elapsedDays + ' dana)';
    if (elapsedDays == 0) {
        summary.newAds.push(JSON.parse(jQueryElement.attr('data-options')).id);
        //summary.newAds2[JSON.parse(jQueryElement.attr('data-options')).id] = true;
        summary.newAds2[JSON.parse(jQueryElement.attr('data-options')).id] = jQueryElement[0].innerText;
        //console.log("new ad: " + JSON.parse(jQueryElement.attr('data-options')).id);
        //jQueryElement.removeClass('EntityList-item--Regular');
        //jQueryElement.removeClass('js-EntityList-item--Regular');
        jQueryElement.addClass('EntityList-item--New');
        jQueryElement.addClass('js-EntityList-item--New');
        jQueryElement.find('.entity-pub-date')[0].innerHTML += '<br/>';

        jQuery('<span/>', {
            class: 'labelAlt',
            text: 'Novi oglas'
        }).appendTo(jQueryElement.find('.entity-pub-date')[0]);
        //var date = priceHistory.length == 0 ? new Date() : new Date(priceHistory[0].dateFirstViewed);
    }
    else {
        jQueryElement.find('.entity-pub-date')[0].innerHTML += '<br/>';
        jQuery('<span/>', {
            class: 'labelAlt',
            text: 'Prvi puta viđen - '
        }).appendTo(jQueryElement.find('.entity-pub-date')[0]);
        var date = priceHistory.length == 0 ? new Date() : new Date(priceHistory[0].dateFirstViewed);
        jQuery('<span/>', {
            class: 'date date--full',
            text: date.toLocaleDateString('hr') + ' ' + elapsedDaysString
        }).appendTo(jQueryElement.find('.entity-pub-date')[0]);
    }
    jQueryElement.find('.entity-pub-date span.label')[0].innerHTML = 'Obnovljen - ';

}

function insertChart(that) {
    var itemId = JSON.parse(that[0].attributes["data-options"].value).id;
    jQuery('<div/>', {
        id: 'chart_div' + itemId,
        text: ''
    }).appendTo($($(that[0]).find("article.entity-body")[0]));

    $('#chart_div' + itemId).css('float', 'left');
    $('#chart_div' + itemId).css('position', 'relative');
    $('#chart_div' + itemId).css('left', '-300px');
    $('#chart_div' + itemId).css('width', 'calc(100% + 300px)');
    $('#chart_div' + itemId).css('height', '200px');
    $('#chart_div' + itemId).css('display', 'none');
    $('#chart_div' + itemId).css('box-shadow', '2px 2px 7px 0px rgba(0,0,0,0.75');
    $('#chart_div' + itemId).css('margin-top', '10px');
}

function addRemoveButtons() {
    jQuery('<div/>', {
        id: 'removeHolder',
        class: 'EntityListBlockWrap EntityListBlockWrap--Compareds js-EntityListBlockWrap--CompareAd content-supplementary-block',
    }).appendTo($('.content-supplementary')[0]);
    jQuery('<div/>', {
        id: 'removeHolderBlock',
        class: 'block-standard block-standard--epsilon',
    }).appendTo($('#removeHolder'));
    jQuery('<h3/>', {
        //id: 'removeHolderBlock',
        class: 'block-standard-title  EntityListBlockTitle',
        text: 'Brisanje povijesti'
    }).appendTo($('#removeHolderBlock'));
    jQuery('<div/>', {
        id: 'removeHolderBlockContent',
        class: 'block-standard block-standard--epsilon',
    }).appendTo($('#removeHolderBlock'));
    //$('#removeHolderBlockContent').css('margin-bottom', 0);
    //$('#removeHolderBlockContent').css('padding', '10px');
    //$('#removeHolderBlockContent').css('border', '0px');
    $('#removeHolder').hide();

    jQuery('<button/>', {
        id: 'removeAllHistoryBtn',
        class: 'button-standard--beta button-standard removeHistory',
        type: 'button',
        text: 'Izbriši svu povijest cijena'
    }).appendTo($('#removeHolderBlockContent'));
    dbase.getNumOfAllAds('#removeAllHistoryBtn', 'Izbriši svu povijest cijena');

    $('#removeAllHistoryBtn').click(function () {
        dbase.deleteTables();
        $('#removeAllHistoryBtn').html('Izbrisano!');
        $('#removeHistory1Month').hide();
        $('#removeHistory2Month').hide();
        $('#removeHistory3Month').hide();
    });
    jQuery('<p/>', {
        id: 'removeHistoryText',
        text: 'Izbriši oglase iz povijesti koje nisam vidio na listi barem u zadnjih:'
    }).appendTo($('#removeHolderBlockContent'));
    //$('#removeHistoryText').css('margin-top', '10px');
    //$('#removeHistoryText').css('margin-bottom', '5px');

    jQuery('<button/>', {
        id: 'removeHistory1Month',
        class: 'button-standard--beta button-standard removeHistory',
        type: 'button',
        text: '1 mjesec'
    }).appendTo($('#removeHolderBlockContent'));
    jQuery('<button/>', {
        id: 'removeHistory2Month',
        class: 'button-standard--beta button-standard removeHistory',
        type: 'button',
        text: '2 mjeseca'
    }).appendTo($('#removeHolderBlockContent'));
    jQuery('<button/>', {
        id: 'removeHistory3Month',
        class: 'button-standard--beta button-standard removeHistory',
        type: 'button',
        text: '3 mjeseca'
    }).appendTo($('#removeHolderBlockContent'));
    dbase.getNumOfOldAds(1, '#removeHistory1Month', '1 mjesec');
    dbase.getNumOfOldAds(2, '#removeHistory2Month', '2 mjeseca');
    dbase.getNumOfOldAds(3, '#removeHistory3Month', '3 mjeseca');

    $('#removeHistory1Month').click(function () {
        dbase.deleteOldAds(1);
        $('#removeHistory1Month').html('Izbrisano!');
        $('#removeHistory2Month').hide();
        $('#removeHistory3Month').hide();
        setTimeout(function () {
            dbase.getNumOfAllAds('#removeAllHistoryBtn', 'Izbriši svu povijest cijena');
        }, 500);
    });
    $('#removeHistory2Month').click(function () {
        dbase.deleteOldAds(2);
        $('#removeHistory2Month').html('Izbrisano');
        $('#removeHistory3Month').hide();
        setTimeout(function () {
            dbase.getNumOfAllAds('#removeAllHistoryBtn', 'Izbriši svu povijest cijena');
        }, 500);
    });
    $('#removeHistory3Month').click(function () {
        dbase.deleteOldAds(2);
        $('#removeHistory3Month').html('Izbrisano!');
        setTimeout(function () {
            dbase.getNumOfAllAds('#removeAllHistoryBtn', 'Izbriši svu povijest cijena');
        }, 500);
    });

    //$('.removeHistory').css('padding', '5px');
    //$('.removeHistory').css('margin-bottom', '5px');
    //$('.removeHistory').css('width', '100%');
    //$('.removeHistory').css('background-image', 'none');
    //$('.removeHistory').css('background-color', 'unset');
    //$('.removeHistory').css('color', 'black');
    //$('.removeHistory').css('text-shadow', 'none');

    $('.removeHistory').mouseover(function () {
        $(this).css('background-color', '#d9d9d9');
    }).mouseout(function () {
        $(this).css('background-color', 'unset');
    });
}

function getImages(response) {
    var index = $($(response).find('.BaseEntityThumbnails--multimedia.Gallery-thumbnails')).length - 1;
    var items = $($(response).find('.BaseEntityThumbnails--multimedia.Gallery-thumbnails')[index]).find('li.BaseEntityThumbnails-item a.BaseEntityThumbnails-link');
    var largeImages = [];
    var thumbs = [];

    for (var i = 0; i < items.length; i++) {
        largeImages.push($(items[i])[0].href);
        if ($($(items[i])).find('img')[0]) {
            thumbs.push($($(items[i])).find('img')[0].src);
        }
        else {
            thumbs.push($(items[i])[0].href);
        }
    }
    return {
        imgs: largeImages,
        thumbs: thumbs
    }
    //console.log(items);
}

function orderSummary() {
    //return;
    var orderResult = order(summary.newAds, summary.newAds2);

    summary.newAds = orderResult.array;
    summary.newAds2 = orderResult.object;

    //console.log('----------------');
    //console.log('new prices!');
    //console.log('----------------');
    var orderResult = order(summary.newPrices, summary.newPrices2);

    summary.newPrices = orderResult.array;
    summary.newPrices2 = orderResult.object;

}

function order(array, object) {
    var listToOrder = []
    for (var i = 0; i < array.length; i++) {
        var position = $('li[data-options="{\"hasCompare\":true,\"id\":' + array[i] + '}"]').length == 0 ?
            $('li[data-options="{\"hasCompare\":false,\"id\":' + array[i] + '}"]').offset().top :
            $('li[data-options="{\"hasCompare\":true,\"id\":' + array[i] + '}"]').offset().top;

        listToOrder.push({
            object: object[array[i]],
            id: array[i],
            position: position
        })
    }
    //console.table(listToOrder);

    var swapped = true;
    while (swapped) {
        swapped = false;
        for (var i = 0; i < listToOrder.length - 1; i++) {
            if (listToOrder[i].position > listToOrder[i + 1].position) {
                var temp = listToOrder[i];
                listToOrder[i] = listToOrder[i + 1];
                listToOrder[i + 1] = temp;
                swapped = true;
            }
        }
    }

    //console.table(listToOrder);

    var newAds2 = {};
    var newAds = [];

    for (var i = 0; i < listToOrder.length; i++) {
        for (var j = 0; j < array.length; j++) {
            if (listToOrder[i].id == array[j]) {
                newAds.push(array[j]);
                newAds2[array[j]] = listToOrder[i].object;
                break;
            }
        }
    }

    return {
        array: newAds,
        object: newAds2
    }
}

//#endregion

//#region reusing

function isCurrentOnActivePage() {
    var curr = window.location.href;
    for (var i = 0; i < activeOn.length; i++) {
        var regEx = new RegExp(activeOn[i]);
        if (regEx.exec(curr) != null) {
            return true;
        }
    }
    return false;
}

function cssElement(url) {
    var link = document.createElement("link");
    link.href = url;
    link.rel = "stylesheet";
    link.type = "text/css";
    return link;
}

function getPrices(element) {
    var priceHRK = $(element).find('.price.price--hrk')[0].innerText.replace(' kn', '').trim();
    var priceEUR = 0;
    if ($(element).find('.price.price--eur').length > 0)
        priceEUR = $(element).find('.price.price--eur')[0].innerText.replace(' € ~', '').trim();
    while (priceHRK.indexOf('.') > -1) {
        priceHRK = priceHRK.replace('.', '');
    }
    while (priceEUR.toString().indexOf('.') > -1) {
        priceEUR = priceEUR.replace('.', '');
    }
    priceHRK = parseInt(priceHRK);
    priceEUR = parseInt(priceEUR);

    return {
        priceHRK: priceHRK,
        priceEUR: priceEUR
    }
}

function onGetHistory(tx, results) {
    //$('#popupInfo #newAds').html('');
    //$('#popupInfo #newAdsList').html('');
    stack.pop();
    this.isLast = stack.length == 0;

    if (!this.details) {
        var priceHistory = results.rows;
        if (results.length > 1) {
            embedPriceHistory(this, priceHistory, this.currID);
        }
        embedDateFirstViewed(this, priceHistory);

        //list
        //if (this.isLast) {
        //    console.log(summary);
        //}
        if (this.isLast && (Object.getOwnPropertyNames(summary.newAds2).length > 0 || Object.getOwnPropertyNames(summary.newPrices2).length > 0)) {
            orderSummary();
            //console.log('last');
            //console.log(Object.getOwnPropertyNames(summary.newAds2));
            //console.log(Object.getOwnPropertyNames(summary.newPrices2));
            if (Object.getOwnPropertyNames(summary.newAds2).length > 0) {
                $('#newAdsP').show();
                $('#popupInfo #newAds').html(Object.getOwnPropertyNames(summary.newAds2).length);
                //var html = '';
                for (var i = 0; i < summary.newAds.length; i++) {
                    //var ad = Object.getOwnPropertyNames(summary.newAds2)[i];
                    var ad = summary.newAds[i];
                    jQuery('<li/>', {
                        id: 'newAd' + ad,
                        text: ''
                    }).appendTo($('#newAdsList'));
                    jQuery('<a/>', {
                        id: 'newAdAnchor' + ad,
                        href: '#',
                        text: summary.newAds2[ad].substring(0, 18) + '...'
                    }).appendTo($('#newAd' + ad));

                    $('#newAdAnchor' + ad).click(onAddItemClick.bind(ad));
                }
            }
            else {
                $('#newAdsP').hide();
            }

            if (Object.getOwnPropertyNames(summary.newPrices2).length > 0) {
                $('#changedPricesP').show();
                $('#popupInfo #changedPriceAds').html(Object.getOwnPropertyNames(summary.newPrices2).length);

                for (var i = 0; i < summary.newPrices.length; i++) {
                    //var pr = Object.getOwnPropertyNames(summary.newPrices2)[i];
                    var pr = summary.newPrices[i];
                    jQuery('<li/>', {
                        id: 'newPrice' + pr,
                        text: ''
                    }).appendTo($('#changedPricesList'));
                    jQuery('<a/>', {
                        id: 'newPriceAnchor' + pr,
                        href: '#',
                        text: summary.newPrices2[pr].substring(0, 18) + '...'
                    }).appendTo($('#newPrice' + pr));

                    $('#newPriceAnchor' + pr).click(onAddItemClick.bind(pr));
                }
            }
            else {
                $('#changedPricesP').hide();
                $('#popupInfo #changedPriceAds').html(0);
            }

            $('#popupInfo').animate({ opacity: 1 }, 500);

            $('#popupInfo .close').click(function () {
                $('#popupInfo').animate({ opacity: 0 }, 300,
					function () {
					    $('#popupInfo').remove();
					});
            })

            //setTimeout(function () {
            //	$('#popupInfo').animate({ opacity: 0 }, 1000,
            //		function () {
            //			$('#popupInfo').remove();
            //		});
            //}, 5000);
        }

        //gfs
    }
    else {
        //details
        var priceHistory = results.rows;
        if (results.length > 1) {
            jQuery('<div/>', {
                id: 'priceHistoryDiv',
                class: 'price-history',
            }).appendTo($('.base-entity-meta'));

            jQuery('<div/>', {
                id: 'priceHistoryText',
            }).appendTo($('#priceHistoryDiv'));
            jQuery('<div/>', {
                id: 'priceHistoryChart',
            }).appendTo($('#priceHistoryDiv'));

            insertPriceHistoryText(priceHistory);
            insertPriceHistoryChart(priceHistory);
        }
        insertDateFirstViewed(priceHistory[0].dateFirstViewed);
    }
}

function onAddItemClick() {
    if ($('li[data-options="{\"hasCompare\":true,\"id\":' + this + '}"]').length == 0) {
        $('html, body').animate({
            scrollTop: $('li[data-options="{\"hasCompare\":false,\"id\":' + this + '}"]').offset().top
        }, 50);
    }
    else {
        $('html, body').animate({
            scrollTop: $('li[data-options="{\"hasCompare\":true,\"id\":' + this + '}"]').offset().top
        }, 50);
    }
}

function formatFloat(num, casasDec, suffix) {
    /// <summary>Fromats float number to wanted formatting</summary>
    /// <param name="num" type="Number">Float number to format</param>
    /// <param name="casasDec" type="Number">Number of decimal numbers, if undefined  or null than 0</param>
    /// <returns type="String">Float number in string format based on passed parametars</returns>
    num = num === Infinity ? 0 : num;
    suffix = suffix == null ? '' : ' ' + suffix;

    if (isNaN(num)) {
        return 0;
    }
    var origNum = num;

    if (casasDec == 'undefined' || casasDec == null) {
        casacDec = 0;
    }

    sepDecimal = ',';
    sepMilhar = '.';

    if (num < 0) {
        num = -num;
        sinal = -1;
    }
    else {
        sinal = 1;
    }

    var resposta = "";
    var part = "";

    if (num != Math.floor(num)) // decimal values present
    {
        part = Math.round((num - Math.floor(num)) * Math.pow(10, casasDec)).toString(); // transforms decimal part into integer (rounded)
        while (part.length < casasDec)
            part = '0' + part;

        if (casasDec > 0) {
            resposta = sepDecimal + part;
            num = Math.floor(num);
        }
        else {
            num = Math.round(num);
        }

    } // end of decimal part
    while (num > 0) // integer part
    {
        part = (num - Math.floor(num / 1000) * 1000).toString(); // part = three less significant digits
        num = Math.floor(num / 1000);

        if (num > 0) {
            while (part.length < 3) // 123.023.123  if sepMilhar = '.'
            {
                part = '0' + part; // 023
            }
        }

        resposta = part + resposta;

        if (num > 0) {
            resposta = sepMilhar + resposta;
        }
    }

    if (origNum < 1 && origNum > -1) {
        resposta = '0' + resposta;
    }

    if (sinal < 0) {
        resposta = '-' + resposta;
    }

    if (resposta == '') {
        return '0';
    }
    return resposta + suffix;
}

function drawChart(elementId, priceHistory) {
    $(elementId).html('');
    var data = [];
    var maxPrice = priceHistory[0].priceHRK;
    var minPrice = priceHistory[0].priceHRK;
    for (var i = 0; i < priceHistory.length; i++) {
        data.push({
            date: JSON.stringify(new Date(priceHistory[i].date)).replace('"', '').replace('"', ''),
            HRK: parseInt(priceHistory[i].priceHRK),
            //EUR: parseInt(priceHistory[i].priceEUR)
        });
        minPrice = Math.min(minPrice, priceHistory[i].priceHRK);
        maxPrice = Math.max(maxPrice, priceHistory[i].priceHRK);
    }
    new Morris.Line({
        // ID of the element in which to draw the chart.
        element: elementId.replace('#', ''),
        // Chart data records -- each entry in this array corresponds to a point on
        // the chart.
        data: data,
        // The name of the data record attribute that contains x-values.
        xkey: 'date',
        // A list of names of data record attributes that contain y-values.
        ykeys: ['HRK'],
        labels: ['HRK'],
        dateFormat: function (date) {
            return new Date(date).toLocaleDateString('hr');
        },
        xLabelFormat: function (date) {
            return new Date(date).toLocaleDateString('hr');
        },
        xLabels: 'day',
        ymin: minPrice * 0.97,
        ymax: maxPrice * 1.03,
        hideHover: 'auto',
        smooth: false,
        yLabelFormat: function (y) {
            return formatFloat(y, 0);
        }
        //postUnits: 'HRK'
    });
}

function getPosition(string, subString, index) {
    return string.split(subString, index).join(subString).length;
}

//#endregion