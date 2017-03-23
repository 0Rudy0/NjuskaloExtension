var dbase = (function () {
	var self = this;
	var db = openDatabase('Njuskalo', '1.0', 'Njuskalo pracenje cijena oglasa', 2 * 1024 * 1024);

	var insertNewPrice = function (advertId, priceHRK, priceEUR) {
		db.transaction(function (tx) {
			tx.executeSql('SELECT * FROM Advert where advertId = ?', [advertId], function (tx, results) {
				if (results.rows.length == 0) {
					insertNewAdvert(tx, advertId, priceHRK, priceEUR);
					//summary.newAds++;
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
								//summary.newPrices++;
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
			tx.executeSql('SELECT a.advertId, a.dateFirstViewed, p.priceHRK, p.priceEUR, p.date FROM Advert a JOIN PriceHistory p on a.advertId = p.advertId where a.advertId = ? ORDER BY date ASC', [advertId], function (tx, results) {
				var tempResult = {
					rows: results.rows,
					length: results.rows.length
				}
				onGetHistory.apply(domItem, [tx, tempResult]);
			}); //onGetHistory.bind(domItem));
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

	var getAllAdverts = function () {
		db.transaction(function (tx) {
			tx.executeSql("select * from advert", [], function (tx, results) {
				msgPort.postMessage({
					cmd: messages.insertAdvertsBulk,
					data: { items: results.rows, length: results.rows.length }
				});
			});
		});
	}

	var getAllAdvertPrices = function () {
		db.transaction(function (tx) {
			tx.executeSql("select * from PriceHistory", [], function (tx, results) {
				msgPort.postMessage({
					cmd: messages.insertAdvertPricesBulk,
					data: { items: results.rows, length: results.rows.length }
				});
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
		getNumOfAllAds: getNumOfAllAds,
		getAllAdverts: getAllAdverts,
		getAllAdvertPrices: getAllAdvertPrices
	};
})();