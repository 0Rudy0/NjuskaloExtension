var allImages = {};

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
var summary = {
	newAds: [],
	newPrices: []
};

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
  	if (request.action == 'start') {
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
  		sessionStorage.setItem('pauseAutoPaging', true);
  		sessionStorage.removeItem('autoPaging');
  		
  	}  	
  });

(function () {
    //dbase.deleteTables();
    //setTimeout(function () {
    //    dbase.createTables();
    //}, 1500);
     dbase.createTables();
    //return;
     $('.UserNav-auth .UserNav-items').append('<li class="UserNav-item"><a href="#" class="item-bit link backupSqlData">Backupiraj podatke</a></li>');
     $('.UserNav-auth .UserNav-items').append('<li class="UserNav-item"><a href="#" class="item-bit link importSqlData">Import</a></li>');
     $('..UserNav-auth .UserNav-items .backupSqlData').click(function () {
         createCsvOfSqlData();
     });
     $('..UserNav-auth .UserNav-items .importSqlData').click(function () {
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
                 //dbase.insertPricesBulk($('#priceHistoryCsvData').val());
                 //$('#importDataModal').remove();
             }, 3000);
         });
     });
     return;
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
		var items = getEntityElements();
		$.each(items, function (index, value) {
			var isLast = false;
			if (index == items.length - 1) {
				isLast = true;
			}
			formatMileageList($(value));
			setTimeout(function () {
				setAdditionalInfo($(value), isLast);
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
})();

//#region only details

function scrollonImageClick() {
	$($('.gallery-action--zoom.js-galleryActionZoom')[0]).click(function () {
		setTimeout(function () {
			$('body').scrollTop($('.base-entity-tab--gallery').offset().top);
		}, 400);
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
	jQuery('<li/>', {
		class: 'date date--full',
		text: 'Prvi puta viđen: ' + new Date(date).toLocaleDateString('hr') + ' ' + elapsedDaysString
	}).appendTo($('.base-entity-meta ul.meta-items'));
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
			//console.log(JSON.parse($(vauItemsDuplicate[i])[0].attributes["data-boot"].value).id);
			if (JSON.parse($(vauItemsDuplicate[i])[0].attributes["data-boot"].value).id ==
				JSON.parse($(vauItems[j])[0].attributes["data-boot"].value).id) {
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
	var currID = JSON.parse(that[0].attributes["data-boot"].value).id;
	var prices = getPrices(that[0]);
	var currTitle = $(that).find('h3.entity-title a').html();
	//console.log(currTitle);
	//var images = getImages();

	setLoadingDiv(that, currID);

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
			data: { itemId: currID, domItem: that }
		})
	}

	else {
		that.isLast = isLast;
		dbase.getPriceHistory(currID, that);
	}

	var link = that.find('h3 a')[0].href;
	that.url = link;
	$.ajax({
		url: link,
		async: true,
		cache: true,
		success: getAdditionalItemInfoCallback.bind(that),
		//success: function (response) {
		//	//var images = getImages(response);
		//},
		error: function (response) {
			//that.find('.loadingDiv').hide();
			console.log('error');
		}
	});
}

function checkBeforeMerge(newAdvert, oldAdvert) {
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
			$(mId + ' .leftContent ul.price-history').append('<li><b>' +
				new Date(ph.date).toLocaleDateString('hr') + '</b> - ' + priceHrk + ' ; ' + priceEur + '</li>');
		}
		$(mId + ' .leftContent p.dateFirstViewed').html(oldAdvert.dateFirstViewed.toLocaleDateString('hr'));
		$(mId + ' .leftContent p.dateLastViewed').html(oldAdvert.dateLastViewed.toLocaleDateString('hr'));

		title = newAdvert.title;
		while (title.indexOf(';') > 0) {
			title = title.replace(';', '<br/>');
		}

		$(mId + ' .rightContent h3').html($(mId + ' .rightContent h3').html() + ' (ID: ' + newAdvert.advertId + ')');
		$(mId + ' .rightContent .title').html(title);
		$(mId + ' .rightContent a.newAdvLink').attr('href', newAdvert.url)
		$(mId + ' .rightContent a.username').html(newAdvert.username);
		$(mId + ' .rightContent a.username').attr('href', 'http://www.njuskalo.hr' + newAdvert.username);
		$(mId + ' .rightContent p.description').html(newAdvert.mainDesc);
		var priceHrk = formatFloat(newAdvert.priceHRK, 0) + ' HRK';
		var priceEur = formatFloat(newAdvert.priceEUR, 0) + ' €';
		$(mId + ' .rightContent ul.price-history').html('<li>' + priceHrk + ' ; ' + priceEur + '</li>');

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

	allImages[JSON.parse(this[0].attributes["data-boot"].value).id] = images;

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
	var currID = JSON.parse(this[0].attributes["data-boot"].value).id;
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

		if ((new Date(priceHistory[i].date)).toLocaleDateString('hr') == (new Date().toLocaleDateString('hr'))) {
			$('#historyBtnList' + itemId).css('background-color', '#cc002c');
			$('#historyBtnList' + itemId).addClass('newPrice');
			summary.newPrices.push(JSON.parse(jQueryElement.attr('data-boot')).id);
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
		summary.newAds.push(JSON.parse(jQueryElement.attr('data-boot')).id);
		//jQueryElement.removeClass('EntityList-item--Regular');
		//jQueryElement.removeClass('js-EntityList-item--Regular');
		jQueryElement.addClass('EntityList-item--New');
		jQueryElement.addClass('js-EntityList-item--New');
	}
	jQueryElement.find('.entity-pub-date span.label')[0].innerHTML = 'Obnovljen - ';
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

function insertChart(that) {
	var itemId = JSON.parse(that[0].attributes["data-boot"].value).id;
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
	var items = $($(response).find('.base-entity-thumbnails--multimedia')[0]).find('li.thumbnail-item a.js-galleryThumbnailLink');
	var largeImages = [];
	var thumbs = [];

	for (var i = 0; i < items.length; i++) {
		largeImages.push($(items[i])[0].href);
		thumbs.push($($(items[i])).find('img')[0].src);
	}
	return {
		imgs: largeImages,
		thumbs: thumbs
	}
	//console.log(items);
}

//#endregion

//#region reusing

function cssElement(url) {
	var link = document.createElement("link");
	link.href = url;
	link.rel = "stylesheet";
	link.type = "text/css";
	return link;
}

function getPrices(element) {
	var priceHRK = $(element).find('.price.price--hrk')[0].innerText.replace(' kn', '').trim();
	var priceEUR = $(element).find('.price.price--eur')[0].innerText.replace(' € ~', '').trim();
	while (priceHRK.indexOf('.') > -1) {
		priceHRK = priceHRK.replace('.', '');
	}
	while (priceEUR.indexOf('.') > -1) {
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
	if (!this.details) {
		//list
		if (this.isLast && (summary.newAds.length > 0 || summary.newPrices.length > 0)) {
			if (summary.newAds.length > 0) {
				$('#newAdsP').show();
				$('#popupInfo #newAds').html(summary.newAds.length);
				//var html = '';
				for (var i = 0; i < summary.newAds.length; i++) {
					jQuery('<li/>', {
						id: 'newAd' + summary.newAds[i],
						text: ''
					}).appendTo($('#newAdsList'));
					jQuery('<a/>', {
						id: 'newAdAnchor' + summary.newAds[i],
						href: '#',
						text: summary.newAds[i]
					}).appendTo($('#newAd' + summary.newAds[i]));

					$('#newAdAnchor' + summary.newAds[i]).click(onAddItemClick.bind(summary.newAds[i]));
				}
			}
			else {
				$('#newAdsP').hide();
			}

			if (summary.newPrices.length > 0) {
				$('#changedPricesP').show();
				$('#popupInfo #changedPriceAds').html(summary.newPrices.length);

				for (var i = 0; i < summary.newPrices.length; i++) {
					jQuery('<li/>', {
						id: 'newPrice' + summary.newPrices[i],
						text: ''
					}).appendTo($('#changedPricesList'));
					jQuery('<a/>', {
						id: 'newPriceAnchor' + summary.newPrices[i],
						href: '#',
						text: summary.newPrices[i]
					}).appendTo($('#newPrice' + summary.newPrices[i]));

					$('#newPriceAnchor' + summary.newPrices[i]).click(onAddItemClick.bind(summary.newPrices[i]));
				}
			}
			else {
				$('#changedPricesP').hide();
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
		var priceHistory = results.rows;
		if (results.length > 1) {
			embedPriceHistory(this, priceHistory, this.currID);
		}
		embedDateFirstViewed(this, priceHistory);
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
	$('html, body').animate({
		scrollTop: $('li[data-boot="{\"hasCompare\":true,\"id\":' + this + '}"]').offset().top
	}, 50);
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

//#endregion