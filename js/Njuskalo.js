// ==UserScript==
// @name        NJUSKALO
// @namespace   http://tampermonkey.net/
// @version     0.9.9
// @description 1 - Fixed layout (increased page width, removed "njuskalo trgovine", banners in the middle of the list, duplicate adds ("istaknuti" + once more in the regular list), auto expand filter)
// @description 1.1 - Formated mileage for each car (thousand separator)
// @description 1.2 - Added calculated horpse powers based on kWh value
// @description	2 - Fetched some extra info for each add (auti: Motor, Mjenjac, Vlasnik, trgovina/osoba; Kuce: Broj soba, godina izgradnje)
// @description 3 - Price tracking for each add -> if there is price history for specific add, a green button appears under star icon that shows price history in the textual form as well as in graph
// @description 4 - Added date of when the advert has appeared on the list (also calculation of days passed since that date)
// @author      0Rudy0
// @match		http://www.njuskalo.hr/auti*
// @match       http://www.njuskalo.hr/prodaja-kuca*
// @match       http://www.njuskalo.hr/prodaja-stanova*
// @match       http://www.njuskalo.hr/nekretnine*
// @match       http://www.njuskalo.hr/novogradnja*
// @match       http://www.njuskalo.hr/?ctl=browse_ads&sort=new&categoryId=9580*
// @match       http://www.njuskalo.hr/?ctl=browse_ads&sort=new&categoryId=9579*
// @require     http://cdnjs.cloudflare.com/ajax/libs/raphael/2.1.2/raphael-min.js
// @require     http://cdnjs.cloudflare.com/ajax/libs/morris.js/0.5.1/morris.min.js
// @require     http://cdnjs.cloudflare.com/ajax/libs/prettify/r224/prettify.min.js
// @resource    cloudflare http://cdnjs.cloudflare.com/ajax/libs/morris.js/0.5.1/morris.css
// @resource    prettify http://cdnjs.cloudflare.com/ajax/libs/prettify/r224/prettify.min.css
// @grant       GM_addStyle
// @grant       GM_getResourceText
// @grant       GM_getResourceURL

// ==/UserScript==

var dbase = (function () {
	var self = this;
	var db = openDatabase('Njuskalo', '1.0', 'Njuskalo pracenje cijena oglasa', 2 * 1024 * 1024);

	var insertNewPrice = function (advertId, priceHRK, priceEUR) {
		db.transaction(function (tx) {
			tx.executeSql('SELECT * FROM Advert where advertId = ?', [advertId], function (tx, results) {
				if (results.rows.length == 0) {
					insertNewAdvert(tx, advertId, priceHRK, priceEUR);
				}
				else {
					updateDateLastViewed(tx, advertId);
					tx.executeSql('SELECT date, priceHRK, priceEUR FROM PriceHistory where advertId = ? ORDER BY date DESC', [advertId], function (tx, historyResults) {
						if (historyResults.rows.length == 0) {
							//ako ne postoji ni jedan entry u priceHistory tablici, jednostavno unesi novi redak
							tx.executeSql('INSERT INTO PriceHistory VALUES (?, ?, ?, DATE("now"))', [advertId, priceHRK, priceEUR]);
						}
						else {
							//u suprotnom, unesi novi redak samo ako na datum zadnjeg unosa u bazi ne postoji zapis s istom cijenom koja je trenutno
							var foundSamePrice = false;
							var lastDate = historyResults.rows[0].date;
							for (var i = 0; i < historyResults.rows.length; i++) {
								if (historyResults.rows[i].date == lastDate && (historyResults.rows[i].priceHRK == priceHRK || historyResults.rows[i].priceEUR == priceEUR)) {
									foundSamePrice = true;
									break;
								}
							}
							if (!foundSamePrice) {
								tx.executeSql('INSERT INTO PriceHistory VALUES (?, ?, ?, DATE("now"))', [advertId, priceHRK, priceEUR]);
							}
						}
					});
				}
			});
		});
	}

	var updateDateLastViewed = function (tx, advertId) {
		tx.executeSql("UPDATE Advert SET dateLastViewed = DATE('now') where advertId = ?", [advertId]);
	}

	var insertNewAdvert = function (tx, advertId, priceHRK, priceEUR) {
		tx.executeSql('INSERT INTO Advert (advertId,dateLastViewed,dateFirstViewed) VALUES (?, Date("now"), Date("now"))', [advertId],
			null, function () {
				//ako se dogodila greška, ne postoji kolona "dateFirstViewed" pa ju prvo dodaj nakon cega ponovi naredbu te updateataj tu kolonu za sve oglase
				tx.executeSql('ALTER TABLE Advert ADD dateFirstViewed VARCHAR(15)', [], function () {
					tx.executeSql('INSERT INTO Advert (advertId,dateLastViewed,dateFirstViewed) VALUES (?, Date("now"), Date("now"))', [advertId], function () {
						tx.executeSql('UPDATE Advert set dateFirstViewed = dateLastViewed');
					});
				}, null);
			});
		tx.executeSql('INSERT INTO PriceHistory VALUES (?, ?, ?, Date("now"))', [advertId, priceHRK, priceEUR]);
	}

	var getPriceHistory = function (advertId, domItem) {
		db.transaction(function (tx) {
			domItem.currID = advertId;
			tx.executeSql('SELECT a.advertId, a.dateFirstViewed, p.priceHRK, p.priceEUR, p.date FROM Advert a JOIN PriceHistory p on a.advertId = p.advertId where a.advertId = ? ORDER BY date ASC', [advertId], onGetHistory.bind(domItem));
		});
	}

	var createTables = function () {
		db.transaction(function (tx) {
			tx.executeSql('CREATE TABLE IF NOT EXISTS Advert (' +
				'advertId integer unique primary key,' +
				'dateLastViewed VARCHAR(80))'
				);
		});
		db.transaction(function (tx) {
			tx.executeSql('CREATE TABLE IF NOT EXISTS PriceHistory (' +
				'advertId integer,' +
				'priceHRK integer,' +
				'priceEUR integer,' +
				'date VARCHAR(15),' +
				'FOREIGN KEY (advertId) REFERENCES Advert (advertId))'
				);
		});
	}

	var deleteTables = function () {
		db.transaction(function (tx) {
			tx.executeSql('DROP TABLE Advert');
		});
		db.transaction(function (tx) {
			tx.executeSql('DROP TABLE PriceHistory');
		});
	}

	var deleteOldAds = function (numOfMonthsOld) {
		var numOfMonthsString = '-' + numOfMonthsOld + ' month';
		db.transaction(function (tx) {
			tx.executeSql("select * from advert where dateLastViewed < date('now', ?)",
				[numOfMonthsString],
				function (tx, results) {
					for (var i = 0; i < results.rows.length; i++) {
						tx.executeSql("delete from advert where advertId = ?", [results.rows[i].advertId]);
						tx.executeSql("delete from PriceHistory where advertId = ?", [results.rows[i].advertId]);
					}
				});
		});
	}

	var getNumOfOldAds = function (numOfMonthsOld, elementId, prefixString) {
		var numOfMonthsString = '-' + numOfMonthsOld + ' month';
		db.transaction(function (tx) {
			tx.executeSql("select * from advert where dateLastViewed < date('now', ?)",
				[numOfMonthsString],
				function (tx, results) {
					$(elementId).html(prefixString + ' ' + results.rows.length);
					$('#removeHolder').show();
				},
			function (e) {
				console.log("error");
			}
			);
		});
	}

	var getNumOfAllAds = function (elementId, prefixString) {
		db.transaction(function (tx) {
			tx.executeSql("select count(*) as count from advert", [], function (tx, results) {
				$(elementId).html(prefixString + ' (' + results.rows[0].count + ')');
			});
		});
	}

	return {
		insertNewPrice: insertNewPrice,		
		getPriceHistory: getPriceHistory,
		createTables: createTables,
		deleteTables: deleteTables,
		deleteOldAds: deleteOldAds,
		getNumOfOldAds: getNumOfOldAds,
		getNumOfAllAds: getNumOfAllAds
	};
})();

(function () {
	'use strict';
	//document.head.appendChild(cssElement(GM_getResourceURL("cloudflare")));
	//document.head.appendChild(cssElement(GM_getResourceURL("prettify")));

	dbase.createTables();
	fixDefaultLayout();
	if ($('.EntityListFilter.block-standard').length == 0) {
		formatMileageAddHP();
		var itemId = window.location.href.substring(window.location.href.lastIndexOf('-') + 1);
		
		var prices = getPrices($('body')[0]);
		dbase.insertNewPrice(itemId, prices.priceHRK, prices.priceEUR);
		dbase.getPriceHistory(itemId, { details: true });
		scrollonImageClick();
	}
	else {
		fixLayoutList();
		var items = getEntityElements();
		$.each(items, function (index, value) {
			formatMileageList($(value));
			setAdditionalInfo($(value));
			insertChart($(value));
		});
		addRemoveButtons();
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
	$('#auxDataTogglerButton').trigger('click');
	//$('.FlexEmbed').hide();
	setTimeout(function () {
		$('body').scrollTop(150);
	}, 400);
}

function getEntityElements() {
	var items = $('.EntityList--Regular ul.EntityList-items>li.EntityList-item--Regular');
	var vauItems = $('.EntityList--VauVau ul.EntityList-items>li.EntityList-item--VauVau');
	var vauItemsDuplicate = $('.EntityList--Regular ul.EntityList-items>li.EntityList-item--VauVau');
	for (var i = 0; i < vauItemsDuplicate.length; i++) {
		var found = false;
		for (var j = 0; j < vauItems.length; j++) {
			if ($(vauItemsDuplicate[i])[0].attributes["data-ad-id"].value == $(vauItems[j])[0].attributes["data-ad-id"].value) {
				$(vauItemsDuplicate[i]).hide();
				found = true;
				break;
			}
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

function setAdditionalInfo(that) {
	var currID = that[0].attributes["data-ad-id"].value;
	var prices = getPrices(that[0]);

	setLoadingDiv(that, currID);
	dbase.insertNewPrice(currID, prices.priceHRK, prices.priceEUR);

	dbase.getPriceHistory(currID, that);

	var link = that.find('h3 a')[0].href;
	$.ajax({
		url: link,
		async: true,
		cache: true,
		success: getAdditionalItemInfoCallback.bind(that),
		error: function (response) {
			console.log('error');
		}
	});
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
			return;
		}
	}
	element.html(element.html().replace(mileage, formatFloat(mileage, 0)));
}

function getAdditionalItemInfoCallback(response) {
	this.find('.loadingDiv').hide();

	var kilometri = "Prijeđeni kilometri: ";
	var motor = 'Motor: ';
	var rows = $(response).find('.table-summary tbody tr');
	var sideDescItems = [];
	for (var j = 0; j < rows.length; j++) {
		if ($($(rows[j]).find('th'))[0].innerHTML == 'Motor:') {
			motor += $($(rows[j]).find('td'))[0].innerHTML + ' - ';
		}
		else if ($($(rows[j]).find('th'))[0].innerHTML == 'Snaga motora:') {
			motor += $($(rows[j]).find('td'))[0].innerHTML.replace(' <abbr title="kilovati">kW</abbr>', ' kWh');
			var toHorsePower = parseInt($($(rows[j]).find('td'))[0].innerHTML.replace(' <abbr title="kilovati">kW</abbr>', '')) * 1.3428;
			sideDescItems.push(motor + ' (' + Math.ceil(toHorsePower) + ' hp)');
		}
		else if ($($(rows[j]).find('th'))[0].innerHTML == 'Mjenjač:') {
			sideDescItems.push('Mjenjač: ' + $($(rows[j]).find('td'))[0].innerHTML);
		}
		else if ($($(rows[j]).find('th'))[0].innerHTML == 'Vlasnik:') {
			sideDescItems.push('Vlasnik: ' + $($(rows[j]).find('td'))[0].innerHTML);
		}
		else if ($($(rows[j]).find('th'))[0].innerHTML == 'Godina izgradnje:') {
			sideDescItems.push('Godina izgradnje: ' + $($(rows[j]).find('td'))[0].innerText);
		}
		else if ($($(rows[j]).find('th'))[0].innerHTML == 'Broj soba:') {
			sideDescItems.push('Broj soba: ' + $($(rows[j]).find('td'))[0].innerText);
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
}

function embedPriceHistory(jQueryElement, priceHistory, itemId) {
	jQuery('<li/>', {
		id: 'historyBtnList' + itemId,
		class: 'tool-item',
		text: ''
	}).appendTo(jQueryElement.find('.tool-items')[0]);
	jQuery('<a/>', {
		id: 'historyBtn' + itemId,
		class: 'icon-item tool',
		text: ''
	}).appendTo(jQueryElement.find('#historyBtnList' + itemId)[0]);
	jQuery('<span/>', {
		id: 'historyBtnIcon' + itemId,
		class: 'icon icon--action icon--xs icon--data',
		text: ''
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
	var elapsedDays = Math.floor((new Date().getTime() - new Date(priceHistory[0].dateFirstViewed).getTime()) / 86400000);
	var elapsedDaysString = '(prije ' + elapsedDays + ' dana)';
	jQueryElement.find('.entity-pub-date span.label')[0].innerHTML = 'Obnovljen - ';
	jQueryElement.find('.entity-pub-date')[0].innerHTML += '<br/>';
	jQuery('<span/>', {
		class: 'labelAlt',
		text: 'Prvi puta viđen - '
	}).appendTo(jQueryElement.find('.entity-pub-date')[0]);
	jQuery('<span/>', {
		class: 'date date--full',
		text: new Date(priceHistory[0].dateFirstViewed).toLocaleDateString('hr') + ' ' + elapsedDaysString
	}).appendTo(jQueryElement.find('.entity-pub-date')[0]);
}

function insertChart(that) {
	var itemId = that[0].attributes["data-ad-id"].value;
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

function fixDefaultLayout() {
	//$('.content-primary').css('margin-left', '0');
	//$('.content-primary').css('padding-left', '0');
}

function onGetHistory(tx, results) {
	if (!this.details) {
		//list
		var priceHistory = results.rows;
		if (results.rows.length > 1) {
			embedPriceHistory(this, priceHistory, this.currID);
		}
		embedDateFirstViewed(this, priceHistory);
	}
	else {
		//details
		var priceHistory = results.rows;
		if (results.rows.length > 1) {
			jQuery('<div/>', {
				id: 'priceHistoryDiv',
				class: 'price-history',
			}).appendTo($('.base-entity-meta'));

			//$('#priceHistoryDiv').css('width', '100%');
			//$('#priceHistoryDiv').css('height', '200px');
			//$('#priceHistoryDiv').css('margin-top', '10px');
			//$('#priceHistoryDiv').css('margin-bottom', '10px');

			jQuery('<div/>', {
				id: 'priceHistoryText',
			}).appendTo($('#priceHistoryDiv'));
			jQuery('<div/>', {
				id: 'priceHistoryChart',
			}).appendTo($('#priceHistoryDiv'));

			//$('#priceHistoryText').css('width', '40%');
			//$('#priceHistoryText').css('height', '100%');
			//$('#priceHistoryText').css('overflow-y', 'auto');
			//$('#priceHistoryText').css('overflow-x', 'hidden');
			//$('#priceHistoryText').css('padding', '0px');

			//$('#priceHistoryText').css('float', 'left');

			//$('#priceHistoryChart').css('width', 'calc(60% - 50px)');
			//$('#priceHistoryChart').css('height', '100%');
			//$('#priceHistoryChart').css('float', 'left');
			//$('#priceHistoryChart').css('margin-left', '50px');

			insertPriceHistoryText(priceHistory);
			insertPriceHistoryChart(priceHistory);
		}
		insertDateFirstViewed(priceHistory[0].dateFirstViewed);
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

//#endregion


















