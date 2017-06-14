var dbase = (function () {
	var self = this;
	var db = openDatabase('Njuskalo', '1.0', 'Njuskalo pracenje cijena oglasa', 2 * 1024 * 1024);
	var allFinished = [];

	var insertNewPrice = function (advertId, priceHRK, priceEUR, title, mainDesc, username, url, callback) {
		console.log(title);
		db.transaction(function (tx) {
			//checkIfFakeNew(tx, advertId, priceHRK, priceEUR, title, mainDesc, username, url, callback);
			//return;
			tx.executeSql('SELECT * FROM Advert where advertId = ?', [advertId], function (tx, results) {
				if (results.rows.length == 0) {
					checkIfFakeNew(advertId, priceHRK, priceEUR, title, mainDesc, username, url, callback);
					//insertNewAdvert(advertId, priceHRK, priceEUR, title, mainDesc, username);
					//summary.newAds++;
				}
				else {
					updateAdvertData(tx, advertId, title, mainDesc, username);
					//updateTitle(tx, advertId, title);
					//updateMainDesc(tx, advertId, mainDesc);
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

	var checkIfFakeNew = function (advertId, priceHRK, priceEUR, title, mainDesc, username, url, callback) {
		//callback(null, { advertId: 3 });

		//ako nema dovoljno elemenata u titleu (barem 5) za identicifirati oglas, jednostavno ga spremi kao novi
		if ((title.match(new RegExp(';', 'g')) || []).length < 5) {
			insertNewAdvert(advertId, priceHRK, priceEUR, title, mainDesc, username);
			return;
		}

		db.transaction(function (tx) {
			tx.executeSql('SELECT * from Advert where title = ?', [title], function (tx, result) {
				if (result.rows.length > 0) {
				    var withSameTitle = result.rows;
				    var found = false;
					for (var i = 0; i < withSameTitle.length; i++) {
						var adv = withSameTitle[i];
						if (adv.username == username) {
						    found = true;
							//if (adv.username != username) {
							tx.executeSql('SELECT date, priceHRK, priceEUR FROM PriceHistory where advertId = ? ORDER BY date DESC', [adv.advertId], function (tx, result) {
								var newAdvert = {
									advertId: advertId,
									priceHRK: priceHRK,
									priceEUR: priceEUR,
									title: title,
									mainDesc: mainDesc,
									username: username,
									url: url
								}
								var oldAdvert = {
									advertId: adv.advertId,
									title: adv.title,
									priceHistory: result.rows,
									mainDesc: adv.mainDesc,
									username: adv.username,
									dateLastViewed: new Date(adv.dateLastViewed),
									dateFirstViewed: new Date(adv.dateFirstViewed)
								}
								callback(newAdvert, oldAdvert);
							});
						}
					}
					if (!found) {
					    insertNewAdvert(advertId, priceHRK, priceEUR, title, mainDesc, username);
					}
				}
				else {
					insertNewAdvert(advertId, priceHRK, priceEUR, title, mainDesc, username);
				}
			}, function (e, a, b) {
				console.log('greska prilikom provjere');
				console.log(e);
				db.transaction(function (tx) {
					tx.executeSql('ALTER TABLE Advert ADD title VARCHAR(120)', []);
					tx.executeSql('ALTER TABLE Advert ADD mainDesc VARCHAR(150)', []);
					tx.executeSql('ALTER TABLE Advert ADD username VARCHAR(50)', []);
				});
				setTimeout(function () {
					//checkIfFakeNew(advertId, priceHRK, priceEUR, title, mainDesc, username, url, callback);
				}, 500)
			});
		});

	}

	var mergeAdverts = function (oldAdvertId, newAdvertId, priceHRK, priceEUR, title, mainDesc, username) {
		db.transaction(function (tx) {
		    tx.executeSql('UPDATE Advert set advertId = ? where advertId = ?', [newAdvertId, oldAdvertId], function (tx) { console.log('error'); }, function (tx) { console.log('success updated Advert table'); });
		    tx.executeSql('UPDATE PriceHistory set advertId = ? where advertId = ?', [newAdvertId, oldAdvertId], function (tx) { console.log('error'); }, function (tx) { console.log('success updated PriceHistory table'); });
			setTimeout(function () {
				insertNewPrice(newAdvertId, priceHRK, priceEUR, title, mainDesc, username, null, null);
			}, 500);
		});
	}

	var updateAdvertData = function (tx, advertId, title, mainDesc, username) {
		tx.executeSql("UPDATE Advert SET dateLastViewed = DATE('now') where advertId = ?", [advertId]);
		tx.executeSql("UPDATE Advert SET title = ? where advertId = ?", [title, advertId]);
		tx.executeSql("UPDATE Advert SET mainDesc = ? where advertId = ?", [mainDesc, advertId]);
		tx.executeSql("UPDATE Advert SET username = ? where advertId = ?", [username, advertId]);
	}

	var insertNewAdvert = function (advertId, priceHRK, priceEUR, title, mainDesc, username) {
	    console.log('inserted ' + advertId);
		db.transaction(function (tx) {
			tx.executeSql('INSERT INTO Advert (advertId,dateLastViewed,dateFirstViewed,title,mainDesc,username) VALUES (?, Date("now"), Date("now"), ?, ?, ?)', [advertId, title, mainDesc, username],
			function () { }, function (e, a, b) {
				console.log('greska prilikom unosenja novog oglasa');
				console.log(e);
				console.log(a);
				console.log(b);
				//ako se dogodila greška, ne postoji kolona "dateFirstViewed" pa ju prvo dodaj nakon cega ponovi naredbu te updateataj kolonu "dateFirstViewied" za sve oglase
				tx.executeSql('ALTER TABLE Advert ADD dateFirstViewed VARCHAR(15)', [],
					function () {
						tx.executeSql('UPDATE Advert set dateFirstViewed = dateLastViewed');
					});
				tx.executeSql('ALTER TABLE Advert ADD title VARCHAR(120)', []);
				tx.executeSql('ALTER TABLE Advert ADD mainDesc VARCHAR(150)', []);
				tx.executeSql('ALTER TABLE Advert ADD username VARCHAR(50)', []);

				setTimeout(function () {
					insertNewAdvert(advertId, priceHRK, priceEUR, title, mainDesc, username);
				}, 500)
			});
			tx.executeSql('INSERT INTO PriceHistory VALUES (?, ?, ?, Date("now"))', [advertId, priceHRK, priceEUR]);
		});

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
				'dateLastViewed VARCHAR(80),' +
				'title VARCHAR(120)' +
				'mainDesc VARCHAR(150)' +
				'username VARCHAR(50))'
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
				console.log(e);
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
		mergeAdverts: mergeAdverts,
		insertNewPrice: insertNewPrice,
		insertNewAdvert: insertNewAdvert,
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