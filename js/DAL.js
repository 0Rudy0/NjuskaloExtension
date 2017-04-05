var dbase = (function () {
	var self = this;
	var db = openDatabase('Njuskalo', '1.0', 'Njuskalo pracenje cijena oglasa', 2 * 1024 * 1024);

	var insertNewPrice = function (data) {
		db.transaction(function (tx) {
			tx.executeSql('SELECT * FROM Advert where advertId = ?', [data.itemId], function (tx, results) {
				if (results.rows.length == 0) {
					insertNewAdvert(tx, data);
				}
				else {
					updateDateLastViewed(tx, data.itemId);
					tx.executeSql('SELECT date, priceHRK, priceEUR FROM PriceHistory where advertId = ? ORDER BY date DESC', [data.itemId], function (tx, historyResults) {
						if (historyResults.rows.length == 0) {
							//ako ne postoji ni jedan entry u priceHistory tablici, jednostavno unesi novi redak
							tx.executeSql('INSERT INTO PriceHistory VALUES (?, ?, ?, DATE("now"))',
								[data.itemId, data.priceHRK, data.priceEUR]);
						}
						else {
							//u suprotnom, unesi novi redak samo ako na datum zadnjeg unosa u bazi ne postoji zapis s istom cijenom koja je trenutno
							var foundSamePrice = false;
							var lastDate = historyResults.rows[0].date;
							for (var i = 0; i < historyResults.rows.length; i++) {
								if (historyResults.rows[i].date == lastDate && (historyResults.rows[i].priceHRK == data.priceHRK || historyResults.rows[i].priceEUR == data.priceEUR)) {
									foundSamePrice = true;
									break;
								}
							}
							if (!foundSamePrice) {
								tx.executeSql('INSERT INTO PriceHistory VALUES (?, ?, ?, DATE("now"))',
									[data.itemId, data.priceHRK, data.priceEUR]);
							}
						}
					});
				}
			});
		});
	}

	var updateDateLastViewed = function (tx, data) {
		tx.executeSql("UPDATE Advert SET dateLastViewed = DATE('now') where advertId = ?", [data.itemId]);
	}

	var insertNewAdvert = function (tx, data) {
		tx.executeSql('INSERT INTO Advert (advertId,dateLastViewed,dateFirstViewed) VALUES (?, Date("now"), Date("now"))', [data.itemId],
			null, function () {
				//ako se dogodila greška, ne postoji kolona "dateFirstViewed" pa ju prvo dodaj nakon cega ponovi naredbu te updateataj tu kolonu za sve oglase
				tx.executeSql('ALTER TABLE Advert ADD dateFirstViewed VARCHAR(15)', [], function () {
					tx.executeSql('INSERT INTO Advert (advertId,dateLastViewed,dateFirstViewed) VALUES (?, Date("now"), Date("now"))', [data.itemId], function () {
						tx.executeSql('UPDATE Advert set dateFirstViewed = dateLastViewed');
					});
				}, null);
			});
		tx.executeSql('INSERT INTO PriceHistory VALUES (?, ?, ?, Date("now"))',
			[data.itemId, data.priceHRK, data.priceEUR]);
	}

	var getPriceHistory = function (data) {
		db.transaction(function (tx) {
			data.domItem.currID = data.itemId;
			tx.executeSql('SELECT a.advertId, a.dateFirstViewed, p.priceHRK, p.priceEUR, p.date FROM Advert a JOIN PriceHistory p on a.advertId = p.advertId where a.advertId = ? ORDER BY date ASC', [data.itemId], function (tx, results) {
				var tempResult = {
					rows: results.rows,
					length: results.rows.length
				}
				msgPort.postMessage({
					cmd: 'onGetHistory',
					data: { domItem: data.domItem, results: tempResult }
				});
				//onGetHistory.bind(domItem)
			});
		});
	}

	var createTables = function () {
		db.transaction(function (tx) {
			tx.executeSql('CREATE TABLE IF NOT EXISTS Advert (' +
				'advertId integer unique primary key,' +
				'dateLastViewed VARCHAR(15),' +
				'dateFirstViewed VARCHAR(15),' + 
				'title VARCHAR(50))'
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
		setTimeout(function () {
			createTables();
		}, 50);
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

	var insertAdvertsBulk = function (data) {
		db.transaction(function (tx) {
			tx.executeSql("select count(*) as count from advert", [], function (tx, results) {
				if (results.rows[0].count == 0) {
					for (var i = 0; i < data.length; i++) {
						var t = data.items[i];
						tx.executeSql('INSERT INTO Advert (advertId,dateLastViewed,dateFirstViewed) VALUES (?, ?, ?)',
							[t.advertId, t.dateLastViewed, t.dateFirstViewed],
							function (tx, results) {});
					}
				}
			});			
		});
	}

	var insertAdvertPricesBulk = function (data) {
		db.transaction(function (tx) {
			tx.executeSql("select count(*) as count from PriceHistory", [], function (tx, results) {
				if (results.rows[0].count == 0) {
					for (var i = 0; i < data.length; i++) {
						var t = data.items[i];
						tx.executeSql('INSERT INTO PriceHistory VALUES (?, ?, ?, ?)',
							[t.advertId, t.priceHRK, t.priceEUR, t.date],
							function (tx, results) {});
					}
				}
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
		insertAdvertsBulk: insertAdvertsBulk,
		insertAdvertPricesBulk: insertAdvertPricesBulk
	};
})();
var msgPort;

chrome.runtime.onConnect.addListener(function (port) {

	//dbase.deleteTables();
	//return;
	//dbase.createTables();
	//return;
	msgPort = port;
	port.onMessage.addListener(function (msg) {
		//msg = JSON.parse(msg);
		dbase[msg.cmd](msg.data);
		//alert('from dal: ' + JSON.stringify(msg));
		port.postMessage({ type: 'test' });
	});
})