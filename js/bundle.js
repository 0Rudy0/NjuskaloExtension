var dbase = (function () {
	var self = this;
	var db = openDatabase('Njuskalo', '1.0', 'Njuskalo pracenje cijena oglasa', 2 * 1024 * 1024);
	var allFinished = [];
	var adsStack = [];
	var newAdsStack = [];
	var newPriceStack = [];

	var insertNewPrice = function (advertId, priceHRK, priceEUR, title, mainDesc, username, url, callback) {
	    adsStack.push(advertId);
	    //console.log('check new ad price ' + adsStack.length);
		db.transaction(function (tx) {			
		    tx.executeSql('SELECT * FROM Advert where advertId = ?', [advertId], function (tx, results) {
		        //console.log(advertId + ': ' + results.rows.length);
		        if (results.rows.length == 0) {
		            newAdsStack.push(advertId);
		            //console.log('insert new ad ' + newAdsStack.length);
					checkIfFakeNew(advertId, priceHRK, priceEUR, title, mainDesc, username, url, callback);
				}
		        else {
		            newPriceStack.push(advertId);
		            //console.log('insert new price ' + newPriceStack.length);
					updateAdvertData(tx, advertId, title, mainDesc, username);//fds
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
							    var row = historyResults.rows[i];
								if (row.date == lastDate &&
									((priceEUR == 0 && row.priceEUR == 0 && row.priceHRK == priceHRK) ||
									(priceEUR == row.priceEUR || row.priceHRK == priceHRK))) {
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
		        if ((newAdsStack.length + newPriceStack.length) == adsStack.length) {
		            console.log('all ads procesed. newPrices' + newPriceStack.length + '; newAds' + newAdsStack.length);
		        }
			});
		});
	}

	var checkIfFakeNew = function (advertId, priceHRK, priceEUR, title, mainDesc, username, url, callback) {
	    //console.log('checking if fake new ' + advertId);

		//ako nema dovoljno elemenata u titleu (barem 5) za identicifirati oglas, jednostavno ga spremi kao novi
	    if ((title.match(new RegExp(';', 'g')) || []).length < 5) {
	        var newAdvert = {
	            advertId: advertId,
	            priceHRK: priceHRK,
	            priceEUR: priceEUR,
	            title: title,
	            mainDesc: mainDesc,
	            username: username,
	            url: url
	        }
	        console.log('nema dovoljno elemenata u titleu, callback ' + advertId + '- ' + title);
	        callback(newAdvert); //send email of new advert
			insertNewAdvert(advertId, priceHRK, priceEUR, title, mainDesc, username);
			return;
        }

        var titleWithoutKm = title;
        var km = 0;
        if (title.indexOf('km') >= 0) {
            titleWithoutKm = '';
            var splitStr = title.split(';');
            //kilometraža je zadnja u arrayu (ako postoji), izbaci ju
            for (var i = 0; i < splitStr.length - 1; i++) {
                titleWithoutKm += splitStr[i] + ";";
            }
            km = parseInt(splitStr[splitStr.length - 1].replace(',', ''));
            titleWithoutKm = titleWithoutKm.substring(0, titleWithoutKm.length - 1); // remove last ';'
        }

		db.transaction(function (tx) {
            tx.executeSql('SELECT * from Advert where title LIKE ?', [titleWithoutKm + '%'], function (tx, result) {
				if (result.rows.length > 0) {
				    var withSameTitle = result.rows;
				    var found = false;
					for (var i = 0; i < withSameTitle.length; i++) {
						var adv = withSameTitle[i];
						if (adv.username == username) {
                            found = true;
                            var km2 = 0;
                            if (adv.title.indexOf('km') >= 0) {
                                var splitStr2 = adv.title.split(';');
                                //kilometraža je zadnja u arrayu (ako postoji)
                                km2 = parseInt(splitStr2[splitStr2.length - 1].replace(',', ''));
                            }

						    var adverts = {
						        newAdvert: {
						            advertId: advertId,
						            priceHRK: priceHRK,
						            priceEUR: priceEUR,
						            title: title,
						            mainDesc: mainDesc,
						            username: username,
						            url: url
						        },
						        oldAdvert: {
						            advertId: adv.advertId,
						            title: adv.title,
						            //priceHistory: result.rows,
						            mainDesc: adv.mainDesc,
						            username: adv.username,
						            dateLastViewed: new Date(adv.dateLastViewed),
						            dateFirstViewed: new Date(adv.dateFirstViewed)
						        },
						        callback: callback
                            }

                            if (km > 0 && km >= km2 * 0.98 && km <= km2 * 1.02) {
                                //auto merge without modal
                                mergeAdverts(adverts.oldAdvert.advertId, adverts.newAdvert.advertId, adverts.newAdvert.priceHRK, adverts.newAdvert.priceEUR, adverts.newAdvert.title, adverts.newAdvert.mainDesc, adverts.newAdvert.username);
                                console.log('---------------------------------------------------------------------------------------------');
                                console.log('auto merged adverts because fake new: ')
                                console.log("OLD title: " + adverts.oldAdvert.title);
                                console.log("NEW title: " + adverts.newAdvert.title);
                                console.log("OLD description: " + adverts.oldAdvert.mainDesc);
                                console.log("NEW description: " + adverts.newAdvert.mainDesc);
                                console.log('---------------------------------------------------------------------------------------------');
                                callback();
                                return;
                            }
                            else {
                                tx.executeSql('SELECT date, priceHRK, priceEUR FROM PriceHistory where advertId = ? ORDER BY date DESC', [adv.advertId], sendAdvertForCompare.bind(adverts));
                                return;
                            }
						}
					}
					if (!found) {
					    var newAdvert = {
					        advertId: advertId,
					        priceHRK: priceHRK,
					        priceEUR: priceEUR,
					        title: title,
					        mainDesc: mainDesc,
					        username: username,
					        url: url
					    }
                        //console.log('pronadjen slican oglas, callback')
					    callback(newAdvert); //send email of new advert
					    insertNewAdvert(advertId, priceHRK, priceEUR, title, mainDesc, username);					   
					}
				}
				else {
				    var newAdvert = {
				        advertId: advertId,
				        priceHRK: priceHRK,
				        priceEUR: priceEUR,
				        title: title,
				        mainDesc: mainDesc,
				        username: username,
				        url: url
				    }
				    //console.log('nije pronadjen slican oglas, callback ' + advertId);
				    callback(newAdvert); //send email of new advert
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
				//setTimeout(function () {
				//	checkIfFakeNew(advertId, priceHRK, priceEUR, title, mainDesc, username, url, callback);
				//}, 500)
			});
		});

	}

	var sendAdvertForCompare = function(tx, result) {
	    var newAdvert = this.newAdvert;
	    var oldAdvert = this.oldAdvert;
	    oldAdvert.priceHistory = result.rows;
        
	    this.callback(newAdvert, oldAdvert);
	}

	var mergeAdverts = function (oldAdvertId, newAdvertId, priceHRK, priceEUR, title, mainDesc, username) {
		db.transaction(function (tx) {
            tx.executeSql('UPDATE Advert set advertId = ? where advertId = ?', [newAdvertId, oldAdvertId],
                function (tx) {
                    console.log('success update advert');
                },
                function (tx) {
                    console.log('error updating advert');
                });

            tx.executeSql('UPDATE PriceHistory set advertId = ? where advertId = ?', [newAdvertId, oldAdvertId],
                function (tx) {
                    console.log('success update price history');
                },
                function (tx) {
                    console.log('error updating price history');
                });

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
	    //console.log('inserted ' + advertId);
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
                'dateFirstViewed VARCHAR(80),' +
				'title VARCHAR(120),' +
				'mainDesc VARCHAR(150),' +
				'username VARCHAR(50))', null, function () {
				    //console.log('success creating Advert table');
				},
            function (err) {
                console.log('error creating Advert table');
            });
		});
		setTimeout(function () {
		    db.transaction(function (tx) {
		        tx.executeSql('CREATE TABLE IF NOT EXISTS PriceHistory (' +
                    'advertId integer,' +
                    'priceHRK integer,' +
                    'priceEUR integer,' +
                    'date VARCHAR(15),' +
                    'FOREIGN KEY (advertId) REFERENCES Advert (advertId))', null, function () {
                        //console.log('success creating PriceHistory table');
                    },
                function (err) {
                    console.log('error creating PriceHistory table');
                });
		    });
		}, 100);
		
	}

	var deleteTables = function () {

	    db.transaction(function (tx) {
	        tx.executeSql('DROP TABLE PriceHistory', null, function () {
	            console.log('success deleting PriceHistory table');
	        },
            function (err) {
                console.log('error deleting PriceHistory table');
            });
	    });

	    setTimeout(function () {
	        db.transaction(function (tx) {
	            tx.executeSql('DROP TABLE Advert', null, function () {
	                console.log('success deleting Advert table');
	            },
                function (err) {
                    console.log('error deleting Advert table');
                });
	        });
	    }, 100);
		
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

	var insertAdvertsBulk = function (csvData) {
	    var lines = csvData.split('\n');
	    for (var i = 1; i < lines.length; i++) {
	        var data = lines[i].split(';');
	        data.index = i;
	        data.maxIndex = lines.length;
	        db.transaction(insertAdvertTransaction.bind(data));
	    }
	}

	var insertAdvertTransaction = function (tx) {
	    var data = this;
	    //console.log(parseInt(data[0]) + ';' + new Date(data[1]) + ';' + new Date(data[2]) + ';' + data[3] + ';' + data[4] + ';' + data[5]);
	    tx.executeSql('INSERT INTO Advert (advertId,dateLastViewed,dateFirstViewed,title,mainDesc,username) VALUES (?, ?, ?, ?, ?, ?)', [parseInt(data[0]), new Date(data[1]), new Date(data[2]), data[3], data[4], data[5]],
           printStatus.bind(data, 'oglasi: '),
           function (e, a, b) {
                console.log('greska prilikom unosenja novog oglasa');
                console.log(a);
        });
	}

	var insertPricesBulk = function (csvData) {
	    var lines = csvData.split('\n');
	    for (var i = 1; i < lines.length; i++) {
	        var data = lines[i].split(';');
	        data.index = i;
	        data.maxIndex = lines.length;
	        db.transaction(insertPriceTransaction.bind(data));
	    }
	}

	var insertPriceTransaction = function (tx) {
	    var data = this;
	    tx.executeSql('INSERT INTO PriceHistory VALUES (?, ?, ?, ?)', [data[0], data[1], data[2], data[3]],
            printStatus.bind(data, 'cijene: '),
            function (e, a, b) {
                console.log('greska prilikom unosenja cijene');
                console.log(a);
        });
	}

	var printStatus = function (str) {
	    var max = this.maxIndex;
	    var i = this.index;
	    if (i % 20 == 0)
	        console.log(str + Math.ceil(i / max * 100) + '%');
	    if (i == max - 1) {
	        console.log(str + 'GOTOVO');
	    }
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
		getAllAdvertPrices: getAllAdvertPrices,
		insertAdvertsBulk: insertAdvertsBulk,
		insertPricesBulk: insertPricesBulk
	};
})();
(function(i,g,c,h,e,k,f){/*! Jssor */
new(function(){});var d=i.$Jease$={$Swing:function(a){return-c.cos(a*c.PI)/2+.5},$Linear:function(a){return a},$InQuad:function(a){return a*a},$OutQuad:function(a){return-a*(a-2)},$InOutQuad:function(a){return(a*=2)<1?1/2*a*a:-1/2*(--a*(a-2)-1)},$InCubic:function(a){return a*a*a},$OutCubic:function(a){return(a-=1)*a*a+1},$InOutCubic:function(a){return(a*=2)<1?1/2*a*a*a:1/2*((a-=2)*a*a+2)},$InQuart:function(a){return a*a*a*a},$OutQuart:function(a){return-((a-=1)*a*a*a-1)},$InOutQuart:function(a){return(a*=2)<1?1/2*a*a*a*a:-1/2*((a-=2)*a*a*a-2)},$InQuint:function(a){return a*a*a*a*a},$OutQuint:function(a){return(a-=1)*a*a*a*a+1},$InOutQuint:function(a){return(a*=2)<1?1/2*a*a*a*a*a:1/2*((a-=2)*a*a*a*a+2)},$InSine:function(a){return 1-c.cos(c.PI/2*a)},$OutSine:function(a){return c.sin(c.PI/2*a)},$InOutSine:function(a){return-1/2*(c.cos(c.PI*a)-1)},$InExpo:function(a){return a==0?0:c.pow(2,10*(a-1))},$OutExpo:function(a){return a==1?1:-c.pow(2,-10*a)+1},$InOutExpo:function(a){return a==0||a==1?a:(a*=2)<1?1/2*c.pow(2,10*(a-1)):1/2*(-c.pow(2,-10*--a)+2)},$InCirc:function(a){return-(c.sqrt(1-a*a)-1)},$OutCirc:function(a){return c.sqrt(1-(a-=1)*a)},$InOutCirc:function(a){return(a*=2)<1?-1/2*(c.sqrt(1-a*a)-1):1/2*(c.sqrt(1-(a-=2)*a)+1)},$InElastic:function(a){if(!a||a==1)return a;var b=.3,d=.075;return-(c.pow(2,10*(a-=1))*c.sin((a-d)*2*c.PI/b))},$OutElastic:function(a){if(!a||a==1)return a;var b=.3,d=.075;return c.pow(2,-10*a)*c.sin((a-d)*2*c.PI/b)+1},$InOutElastic:function(a){if(!a||a==1)return a;var b=.45,d=.1125;return(a*=2)<1?-.5*c.pow(2,10*(a-=1))*c.sin((a-d)*2*c.PI/b):c.pow(2,-10*(a-=1))*c.sin((a-d)*2*c.PI/b)*.5+1},$InBack:function(a){var b=1.70158;return a*a*((b+1)*a-b)},$OutBack:function(a){var b=1.70158;return(a-=1)*a*((b+1)*a+b)+1},$InOutBack:function(a){var b=1.70158;return(a*=2)<1?1/2*a*a*(((b*=1.525)+1)*a-b):1/2*((a-=2)*a*(((b*=1.525)+1)*a+b)+2)},$InBounce:function(a){return 1-d.$OutBounce(1-a)},$OutBounce:function(a){return a<1/2.75?7.5625*a*a:a<2/2.75?7.5625*(a-=1.5/2.75)*a+.75:a<2.5/2.75?7.5625*(a-=2.25/2.75)*a+.9375:7.5625*(a-=2.625/2.75)*a+.984375},$InOutBounce:function(a){return a<1/2?d.$InBounce(a*2)*.5:d.$OutBounce(a*2-1)*.5+.5},$GoBack:function(a){return 1-c.abs(2-1)},$InWave:function(a){return 1-c.cos(a*c.PI*2)},$OutWave:function(a){return c.sin(a*c.PI*2)},$OutJump:function(a){return 1-((a*=2)<1?(a=1-a)*a*a:(a-=1)*a*a)},$InJump:function(a){return(a*=2)<1?a*a*a:(a=2-a)*a*a},$Early:c.ceil,$Late:c.floor};i.$JssorEasing$={$EaseSwing:d.$Swing,$EaseLinear:d.$Linear,$EaseInQuad:d.$InQuad,$EaseOutQuad:d.$OutQuad,$EaseInOutQuad:d.$InOutQuad,$EaseInCubic:d.$InCubic,$EaseOutCubic:d.$OutCubic,$EaseInOutCubic:d.$InOutCubic,$EaseInQuart:d.$InQuart,$EaseOutQuart:d.$OutQuart,$EaseInOutQuart:d.$InOutQuart,$EaseInQuint:d.$InQuint,$EaseOutQuint:d.$OutQuint,$EaseInOutQuint:d.$InOutQuint,$EaseInSine:d.$InSine,$EaseOutSine:d.$OutSine,$EaseInOutSine:d.$InOutSine,$EaseInExpo:d.$InExpo,$EaseOutExpo:d.$OutExpo,$EaseInOutExpo:d.$InOutExpo,$EaseInCirc:d.$InCirc,$EaseOutCirc:d.$OutCirc,$EaseInOutCirc:d.$InOutCirc,$EaseInElastic:d.$InElastic,$EaseOutElastic:d.$OutElastic,$EaseInOutElastic:d.$InOutElastic,$EaseInBack:d.$InBack,$EaseOutBack:d.$OutBack,$EaseInOutBack:d.$InOutBack,$EaseInBounce:d.$InBounce,$EaseOutBounce:d.$OutBounce,$EaseInOutBounce:d.$InOutBounce,$EaseGoBack:d.$GoBack,$EaseInWave:d.$InWave,$EaseOutWave:d.$OutWave,$EaseOutJump:d.$OutJump,$EaseInJump:d.$InJump};var b=new function(){var j=this,yb=/\S+/g,K=1,ib=2,lb=3,kb=4,ob=5,L,s=0,l=0,t=0,A=0,B=0,E=navigator,tb=E.appName,o=E.userAgent,q=parseFloat;function Gb(){if(!L){L={cf:"ontouchstart"in i||"createTouch"in g};var a;if(E.pointerEnabled||(a=E.msPointerEnabled))L.Wd=a?"msTouchAction":"touchAction"}return L}function v(h){if(!s){s=-1;if(tb=="Microsoft Internet Explorer"&&!!i.attachEvent&&!!i.ActiveXObject){var e=o.indexOf("MSIE");s=K;t=q(o.substring(e+5,o.indexOf(";",e)));l=g.documentMode||t}else if(tb=="Netscape"&&!!i.addEventListener){var d=o.indexOf("Firefox"),b=o.indexOf("Safari"),f=o.indexOf("Chrome"),c=o.indexOf("AppleWebKit");if(d>=0){s=ib;l=q(o.substring(d+8))}else if(b>=0){var j=o.substring(0,b).lastIndexOf("/");s=f>=0?kb:lb;l=q(o.substring(j+1,b))}else{var a=/Trident\/.*rv:([0-9]{1,}[\.0-9]{0,})/i.exec(o);if(a){s=K;l=t=q(a[1])}}if(c>=0)B=q(o.substring(c+12))}else{var a=/(opera)(?:.*version|)[ \/]([\w.]+)/i.exec(o);if(a){s=ob;l=q(a[2])}}}return h==s}function r(){return v(K)}function hb(){return r()&&(l<6||g.compatMode=="BackCompat")}function jb(){return v(lb)}function nb(){return v(ob)}function db(){return jb()&&B>534&&B<535}function H(){v();return B>537||l>42||s==K&&l>=11}function fb(){return r()&&l<9}function eb(a){var b,c;return function(g){if(!b){b=e;var d=a.substr(0,1).toUpperCase()+a.substr(1);n([a].concat(["WebKit","ms","Moz","O","webkit"]),function(h,e){var b=a;if(e)b=h+d;if(g.style[b]!=f)return c=b})}return c}}function cb(b){var a;return function(c){a=a||eb(b)(c)||b;return a}}var M=cb("transform");function sb(a){return{}.toString.call(a)}var pb={};n(["Boolean","Number","String","Function","Array","Date","RegExp","Object"],function(a){pb["[object "+a+"]"]=a.toLowerCase()});function n(b,d){var a,c;if(sb(b)=="[object Array]"){for(a=0;a<b.length;a++)if(c=d(b[a],a,b))return c}else for(a in b)if(c=d(b[a],a,b))return c}function G(a){return a==h?String(a):pb[sb(a)]||"object"}function qb(a){for(var b in a)return e}function C(a){try{return G(a)=="object"&&!a.nodeType&&a!=a.window&&(!a.constructor||{}.hasOwnProperty.call(a.constructor.prototype,"isPrototypeOf"))}catch(b){}}function p(a,b){return{x:a,y:b}}function wb(b,a){setTimeout(b,a||0)}function D(b,d,c){var a=!b||b=="inherit"?"":b;n(d,function(c){var b=c.exec(a);if(b){var d=a.substr(0,b.index),e=a.substr(b.index+b[0].length+1,a.length-1);a=d+e}});a=c+(!a.indexOf(" ")?"":" ")+a;return a}function R(b,a){if(l<9)b.style.filter=a}j.ef=Gb;j.Md=r;j.kf=jb;j.Pd=nb;j.pf=H;j.dc=fb;eb("transform");j.Sd=function(){return l};j.rf=function(){v();return B};j.$Delay=wb;function Y(a){a.constructor===Y.caller&&a.ue&&a.ue.apply(a,Y.caller.arguments)}j.ue=Y;j.pb=function(a){if(j.lf(a))a=g.getElementById(a);return a};function u(a){return a||i.event}j.re=u;j.Dc=function(b){b=u(b);var a=b.target||b.srcElement||g;if(a.nodeType==3)a=j.se(a);return a};j.ve=function(a){a=u(a);return{x:a.pageX||a.clientX||0,y:a.pageY||a.clientY||0}};function w(c,d,a){if(a!==f)c.style[d]=a==f?"":a;else{var b=c.currentStyle||c.style;a=b[d];if(a==""&&i.getComputedStyle){b=c.ownerDocument.defaultView.getComputedStyle(c,h);b&&(a=b.getPropertyValue(d)||b[d])}return a}}function ab(b,c,a,d){if(a!==f){if(a==h)a="";else d&&(a+="px");w(b,c,a)}else return q(w(b,c))}function m(c,a){var d=a?ab:w,b;if(a&4)b=cb(c);return function(e,f){return d(e,b?b(e):c,f,a&2)}}function Bb(b){if(r()&&t<9){var a=/opacity=([^)]*)/.exec(b.style.filter||"");return a?q(a[1])/100:1}else return q(b.style.opacity||"1")}function Db(b,a,f){if(r()&&t<9){var h=b.style.filter||"",i=new RegExp(/[\s]*alpha\([^\)]*\)/g),e=c.round(100*a),d="";if(e<100||f)d="alpha(opacity="+e+") ";var g=D(h,[i],d);R(b,g)}else b.style.opacity=a==1?"":c.round(a*100)/100}var N={$Rotate:["rotate"],$RotateX:["rotateX"],$RotateY:["rotateY"],$SkewX:["skewX"],$SkewY:["skewY"]};if(!H())N=F(N,{$ScaleX:["scaleX",2],$ScaleY:["scaleY",2],$TranslateZ:["translateZ",1]});function O(d,a){var c="";if(a){if(r()&&l&&l<10){delete a.$RotateX;delete a.$RotateY;delete a.$TranslateZ}b.a(a,function(d,b){var a=N[b];if(a){var e=a[1]||0;if(P[b]!=d)c+=" "+a[0]+"("+d+(["deg","px",""])[e]+")"}});if(H()){if(a.$TranslateX||a.$TranslateY||a.$TranslateZ!=f)c+=" translate3d("+(a.$TranslateX||0)+"px,"+(a.$TranslateY||0)+"px,"+(a.$TranslateZ||0)+"px)";if(a.$ScaleX==f)a.$ScaleX=1;if(a.$ScaleY==f)a.$ScaleY=1;if(a.$ScaleX!=1||a.$ScaleY!=1)c+=" scale3d("+a.$ScaleX+", "+a.$ScaleY+", 1)"}}d.style[M(d)]=c}j.he=m("transformOrigin",4);j.of=m("backfaceVisibility",4);j.nf=m("transformStyle",4);j.Kf=m("perspective",6);j.bg=m("perspectiveOrigin",4);j.gg=function(a,b){if(r()&&t<9||t<10&&hb())a.style.zoom=b==1?"":b;else{var c=M(a),f="scale("+b+")",e=a.style[c],g=new RegExp(/[\s]*scale\(.*?\)/g),d=D(e,[g],f);a.style[c]=d}};j.Wb=function(b,a){return function(c){c=u(c);var e=c.type,d=c.relatedTarget||(e=="mouseout"?c.toElement:c.fromElement);(!d||d!==a&&!j.fg(a,d))&&b(c)}};j.f=function(a,c,d,b){a=j.pb(a);if(a.addEventListener){c=="mousewheel"&&a.addEventListener("DOMMouseScroll",d,b);a.addEventListener(c,d,b)}else if(a.attachEvent){a.attachEvent("on"+c,d);b&&a.setCapture&&a.setCapture()}};j.P=function(a,c,d,b){a=j.pb(a);if(a.removeEventListener){c=="mousewheel"&&a.removeEventListener("DOMMouseScroll",d,b);a.removeEventListener(c,d,b)}else if(a.detachEvent){a.detachEvent("on"+c,d);b&&a.releaseCapture&&a.releaseCapture()}};j.Tb=function(a){a=u(a);a.preventDefault&&a.preventDefault();a.cancel=e;a.returnValue=k};j.hg=function(a){a=u(a);a.stopPropagation&&a.stopPropagation();a.cancelBubble=e};j.K=function(d,c){var a=[].slice.call(arguments,2),b=function(){var b=a.concat([].slice.call(arguments,0));return c.apply(d,b)};return b};j.cg=function(a,b){if(b==f)return a.textContent||a.innerText;var c=g.createTextNode(b);j.Ac(a);a.appendChild(c)};j.Kb=function(d,c){for(var b=[],a=d.firstChild;a;a=a.nextSibling)(c||a.nodeType==1)&&b.push(a);return b};function rb(a,c,e,b){b=b||"u";for(a=a?a.firstChild:h;a;a=a.nextSibling)if(a.nodeType==1){if(V(a,b)==c)return a;if(!e){var d=rb(a,c,e,b);if(d)return d}}}j.u=rb;function T(a,d,f,b){b=b||"u";var c=[];for(a=a?a.firstChild:h;a;a=a.nextSibling)if(a.nodeType==1){V(a,b)==d&&c.push(a);if(!f){var e=T(a,d,f,b);if(e.length)c=c.concat(e)}}return c}function mb(a,c,d){for(a=a?a.firstChild:h;a;a=a.nextSibling)if(a.nodeType==1){if(a.tagName==c)return a;if(!d){var b=mb(a,c,d);if(b)return b}}}j.lg=mb;function gb(a,c,e){var b=[];for(a=a?a.firstChild:h;a;a=a.nextSibling)if(a.nodeType==1){(!c||a.tagName==c)&&b.push(a);if(!e){var d=gb(a,c,e);if(d.length)b=b.concat(d)}}return b}j.kg=gb;j.ag=function(b,a){return b.getElementsByTagName(a)};function F(){var e=arguments,d,c,b,a,h=1&e[0],g=1+h;d=e[g-1]||{};for(;g<e.length;g++)if(c=e[g])for(b in c){a=c[b];if(a!==f){a=c[b];var i=d[b];d[b]=h&&(C(i)||C(a))?F(h,{},i,a):a}}return d}j.p=F;function Z(f,g){var d={},c,a,b;for(c in f){a=f[c];b=g[c];if(a!==b){var e;if(C(a)&&C(b)){a=Z(a,b);e=!qb(a)}!e&&(d[c]=a)}}return d}j.xd=function(a){return G(a)=="function"};j.lf=function(a){return G(a)=="string"};j.cc=function(a){return!isNaN(q(a))&&isFinite(a)};j.a=n;j.Yc=C;function S(a){return g.createElement(a)}j.vb=function(){return S("DIV")};j.Sf=function(){return S("SPAN")};j.Dd=function(){};function W(b,c,a){if(a==f)return b.getAttribute(c);b.setAttribute(c,a)}function V(a,b){return W(a,b)||W(a,"data-"+b)}j.v=W;j.j=V;function y(b,a){if(a==f)return b.className;b.className=a}j.oc=y;function vb(b){var a={};n(b,function(b){if(b!=f)a[b]=b});return a}function xb(b,a){return b.match(a||yb)}function Q(b,a){return vb(xb(b||"",a))}j.Mf=xb;function bb(b,c){var a="";n(c,function(c){a&&(a+=b);a+=c});return a}function J(a,c,b){y(a,bb(" ",F(Z(Q(y(a)),Q(c)),Q(b))))}j.se=function(a){return a.parentNode};j.R=function(a){j.db(a,"none")};j.z=function(a,b){j.db(a,b?"none":"")};j.Tf=function(b,a){b.removeAttribute(a)};j.Zf=function(){return r()&&l<10};j.Xf=function(d,a){if(a)d.style.clip="rect("+c.round(a.$Top||a.L||0)+"px "+c.round(a.$Right)+"px "+c.round(a.$Bottom)+"px "+c.round(a.$Left||a.G||0)+"px)";else if(a!==f){var h=d.style.cssText,g=[new RegExp(/[\s]*clip: rect\(.*?\)[;]?/i),new RegExp(/[\s]*cliptop: .*?[;]?/i),new RegExp(/[\s]*clipright: .*?[;]?/i),new RegExp(/[\s]*clipbottom: .*?[;]?/i),new RegExp(/[\s]*clipleft: .*?[;]?/i)],e=D(h,g,"");b.fc(d,e)}};j.U=function(){return+new Date};j.J=function(b,a){b.appendChild(a)};j.ec=function(b,a,c){(c||a.parentNode).insertBefore(b,a)};j.Fb=function(b,a){a=a||b.parentNode;a&&a.removeChild(b)};j.Lf=function(a,b){n(a,function(a){j.Fb(a,b)})};j.Ac=function(a){j.Lf(j.Kb(a,e),a)};j.Rf=function(a,b){var c=j.se(a);b&1&&j.C(a,(j.l(c)-j.l(a))/2);b&2&&j.B(a,(j.n(c)-j.n(a))/2)};j.Nb=function(b,a){return parseInt(b,a||10)};j.Ce=q;j.fg=function(b,a){var c=g.body;while(a&&b!==a&&c!==a)try{a=a.parentNode}catch(d){return k}return b===a};function X(d,c,b){var a=d.cloneNode(!c);!b&&j.Tf(a,"id");return a}j.Y=X;j.Gb=function(d,f){var a=new Image;function b(e,d){j.P(a,"load",b);j.P(a,"abort",c);j.P(a,"error",c);f&&f(a,d)}function c(a){b(a,e)}if(nb()&&l<11.6||!d)b(!d);else{j.f(a,"load",b);j.f(a,"abort",c);j.f(a,"error",c);a.src=d}};j.Ue=function(d,a,e){var c=d.length+1;function b(b){c--;if(a&&b&&b.src==a.src)a=b;!c&&e&&e(a)}n(d,function(a){j.Gb(a.src,b)});b()};j.od=function(a,g,i,h){if(h)a=X(a);var c=T(a,g);if(!c.length)c=b.ag(a,g);for(var f=c.length-1;f>-1;f--){var d=c[f],e=X(i);y(e,y(d));b.fc(e,d.style.cssText);b.ec(e,d);b.Fb(d)}return a};function Eb(a){var l=this,p="",r=["av","pv","ds","dn"],e=[],q,k=0,h=0,d=0;function i(){J(a,q,e[d||k||h&2||h]);b.T(a,"pointer-events",d?"none":"")}function c(){k=0;i();j.P(g,"mouseup",c);j.P(g,"touchend",c);j.P(g,"touchcancel",c)}function o(a){if(d)j.Tb(a);else{k=4;i();j.f(g,"mouseup",c);j.f(g,"touchend",c);j.f(g,"touchcancel",c)}}l.qd=function(a){if(a===f)return h;h=a&2||a&1;i()};l.$Enable=function(a){if(a===f)return!d;d=a?0:3;i()};l.$Elmt=a=j.pb(a);var m=b.Mf(y(a));if(m)p=m.shift();n(r,function(a){e.push(p+a)});q=bb(" ",e);e.unshift("");j.f(a,"mousedown",o);j.f(a,"touchstart",o)}j.Mb=function(a){return new Eb(a)};j.T=w;j.jb=m("overflow");j.B=m("top",2);j.C=m("left",2);j.l=m("width",2);j.n=m("height",2);j.uc=m("marginLeft",2);j.wc=m("marginTop",2);j.A=m("position");j.db=m("display");j.I=m("zIndex",1);j.Ab=function(b,a,c){if(a!=f)Db(b,a,c);else return Bb(b)};j.fc=function(a,b){if(b!=f)a.style.cssText=b;else return a.style.cssText};j.Ke=function(b,a){if(a===f){a=w(b,"backgroundImage")||"";var c=/\burl\s*\(\s*["']?([^"'\r\n,]+)["']?\s*\)/gi.exec(a)||[];return c[1]}w(b,"backgroundImage",a?"url('"+a+"')":"")};var U={$Opacity:j.Ab,$Top:j.B,$Left:j.C,Q:j.l,S:j.n,Eb:j.A,Nh:j.db,$ZIndex:j.I};function x(g,l){var e=fb(),b=H(),d=db(),i=M(g);function k(b,d,a){var e=b.ub(p(-d/2,-a/2)),f=b.ub(p(d/2,-a/2)),g=b.ub(p(d/2,a/2)),h=b.ub(p(-d/2,a/2));b.ub(p(300,300));return p(c.min(e.x,f.x,g.x,h.x)+d/2,c.min(e.y,f.y,g.y,h.y)+a/2)}function a(d,a){a=a||{};var n=a.$TranslateZ||0,p=(a.$RotateX||0)%360,q=(a.$RotateY||0)%360,u=(a.$Rotate||0)%360,l=a.$ScaleX,m=a.$ScaleY,g=a.Mh;if(l==f)l=1;if(m==f)m=1;if(g==f)g=1;if(e){n=0;p=0;q=0;g=0}var c=new Ab(a.$TranslateX,a.$TranslateY,n);c.$RotateX(p);c.$RotateY(q);c.Qe(u);c.Oe(a.$SkewX,a.$SkewY);c.$Scale(l,m,g);if(b){c.$Move(a.G,a.L);d.style[i]=c.Pe()}else if(!A||A<9){var o="",h={x:0,y:0};if(a.$OriginalWidth)h=k(c,a.$OriginalWidth,a.$OriginalHeight);j.wc(d,h.y);j.uc(d,h.x);o=c.ze();var s=d.style.filter,t=new RegExp(/[\s]*progid:DXImageTransform\.Microsoft\.Matrix\([^\)]*\)/g),r=D(s,[t],o);R(d,r)}}x=function(e,c){c=c||{};var i=c.G,k=c.L,g;n(U,function(a,b){g=c[b];g!==f&&a(e,g)});j.Xf(e,c.$Clip);if(!b){i!=f&&j.C(e,(c.me||0)+i);k!=f&&j.B(e,(c.we||0)+k)}if(c.Re)if(d)wb(j.K(h,O,e,c));else a(e,c)};j.qb=O;if(d)j.qb=x;if(e)j.qb=a;else if(!b)a=O;j.O=x;x(g,l)}j.qb=x;j.O=x;function Ab(j,k,o){var d=this,b=[1,0,0,0,0,1,0,0,0,0,1,0,j||0,k||0,o||0,1],i=c.sin,g=c.cos,l=c.tan;function f(a){return a*c.PI/180}function n(a,b){return{x:a,y:b}}function m(b,c,f,g,i,l,n,o,q,t,u,w,y,A,C,F,a,d,e,h,j,k,m,p,r,s,v,x,z,B,D,E){return[b*a+c*j+f*r+g*z,b*d+c*k+f*s+g*B,b*e+c*m+f*v+g*D,b*h+c*p+f*x+g*E,i*a+l*j+n*r+o*z,i*d+l*k+n*s+o*B,i*e+l*m+n*v+o*D,i*h+l*p+n*x+o*E,q*a+t*j+u*r+w*z,q*d+t*k+u*s+w*B,q*e+t*m+u*v+w*D,q*h+t*p+u*x+w*E,y*a+A*j+C*r+F*z,y*d+A*k+C*s+F*B,y*e+A*m+C*v+F*D,y*h+A*p+C*x+F*E]}function e(c,a){return m.apply(h,(a||b).concat(c))}d.$Scale=function(a,c,d){if(a!=1||c!=1||d!=1)b=e([a,0,0,0,0,c,0,0,0,0,d,0,0,0,0,1])};d.$Move=function(a,c,d){b[12]+=a||0;b[13]+=c||0;b[14]+=d||0};d.$RotateX=function(c){if(c){a=f(c);var d=g(a),h=i(a);b=e([1,0,0,0,0,d,h,0,0,-h,d,0,0,0,0,1])}};d.$RotateY=function(c){if(c){a=f(c);var d=g(a),h=i(a);b=e([d,0,-h,0,0,1,0,0,h,0,d,0,0,0,0,1])}};d.Qe=function(c){if(c){a=f(c);var d=g(a),h=i(a);b=e([d,h,0,0,-h,d,0,0,0,0,1,0,0,0,0,1])}};d.Oe=function(a,c){if(a||c){j=f(a);k=f(c);b=e([1,l(k),0,0,l(j),1,0,0,0,0,1,0,0,0,0,1])}};d.ub=function(c){var a=e(b,[1,0,0,0,0,1,0,0,0,0,1,0,c.x,c.y,0,1]);return n(a[12],a[13])};d.Pe=function(){return"matrix3d("+b.join(",")+")"};d.ze=function(){return"progid:DXImageTransform.Microsoft.Matrix(M11="+b[0]+", M12="+b[4]+", M21="+b[1]+", M22="+b[5]+", SizingMethod='auto expand')"}}new(function(){var a=this;function b(d,g){for(var j=d[0].length,i=d.length,h=g[0].length,f=[],c=0;c<i;c++)for(var k=f[c]=[],b=0;b<h;b++){for(var e=0,a=0;a<j;a++)e+=d[c][a]*g[a][b];k[b]=e}return f}a.$ScaleX=function(b,c){return a.Td(b,c,0)};a.$ScaleY=function(b,c){return a.Td(b,0,c)};a.Td=function(a,c,d){return b(a,[[c,0],[0,d]])};a.ub=function(d,c){var a=b(d,[[c.x],[c.y]]);return p(a[0][0],a[1][0])}});var P={me:0,we:0,G:0,L:0,$Zoom:1,$ScaleX:1,$ScaleY:1,$Rotate:0,$RotateX:0,$RotateY:0,$TranslateX:0,$TranslateY:0,$TranslateZ:0,$SkewX:0,$SkewY:0};j.rc=function(c,d){var a=c||{};if(c)if(b.xd(c))a={hb:a};else if(b.xd(c.$Clip))a.$Clip={hb:c.$Clip};a.hb=a.hb||d;if(a.$Clip)a.$Clip.hb=a.$Clip.hb||d;return a};function ub(c,a){var b={};n(c,function(c,d){var e=c;if(a[d]!=f)if(j.cc(c))e=c+a[d];else e=ub(c,a[d]);b[d]=e});return b}j.Ve=ub;j.de=function(l,m,x,q,z,A,n){var a=m;if(l){a={};for(var i in m){var B=A[i]||1,w=z[i]||[0,1],g=(x-w[0])/w[1];g=c.min(c.max(g,0),1);g=g*B;var u=c.floor(g);if(g!=u)g-=u;var j=q.hb||d.$Linear,k,C=l[i],p=m[i];if(b.cc(p)){j=q[i]||j;var y=j(g);k=C+p*y}else{k=b.p({Sb:{}},l[i]);var v=q[i]||{};b.a(p.Sb||p,function(d,a){j=v[a]||v.hb||j;var c=j(g),b=d*c;k.Sb[a]=b;k[a]+=b})}a[i]=k}var t=b.a(m,function(b,a){return P[a]!=f});t&&b.a(P,function(c,b){if(a[b]==f&&l[b]!==f)a[b]=l[b]});if(t){if(a.$Zoom)a.$ScaleX=a.$ScaleY=a.$Zoom;a.$OriginalWidth=n.$OriginalWidth;a.$OriginalHeight=n.$OriginalHeight;a.Re=e}}if(m.$Clip&&n.$Move){var o=a.$Clip.Sb,s=(o.$Top||0)+(o.$Bottom||0),r=(o.$Left||0)+(o.$Right||0);a.$Left=(a.$Left||0)+r;a.$Top=(a.$Top||0)+s;a.$Clip.$Left-=r;a.$Clip.$Right-=r;a.$Clip.$Top-=s;a.$Clip.$Bottom-=s}if(a.$Clip&&b.Zf()&&!a.$Clip.$Top&&!a.$Clip.$Left&&!a.$Clip.L&&!a.$Clip.G&&a.$Clip.$Right==n.$OriginalWidth&&a.$Clip.$Bottom==n.$OriginalHeight)a.$Clip=h;return a}};function m(){var a=this,d=[];function h(a,b){d.push({vc:a,Gc:b})}function g(a,c){b.a(d,function(b,e){b.vc==a&&b.Gc===c&&d.splice(e,1)})}a.$On=a.addEventListener=h;a.$Off=a.removeEventListener=g;a.m=function(a){var c=[].slice.call(arguments,1);b.a(d,function(b){b.vc==a&&b.Gc.apply(i,c)})}}var l=function(B,E,g,M,P,K){B=B||0;var a=this,q,n,o,v,C=0,I,J,H,D,A=0,j=0,m=0,z,l,d,f,p,y,w=[],x;function Q(a){d+=a;f+=a;l+=a;j+=a;m+=a;A+=a}function u(o){var h=o;if(p)if(!y&&(h>=f||h<d)||y&&h>=d)h=((h-d)%p+p)%p+d;if(!z||v||j!=h){var i=c.min(h,f);i=c.max(i,d);if(!z||v||i!=m){if(K){var k=(i-l)/(E||1);if(g.$Reverse)k=1-k;var n=b.de(P,K,k,I,H,J,g);if(x)b.a(n,function(b,a){x[a]&&x[a](M,b)});else b.O(M,n)}a.Jc(m-l,i-l);var r=m,q=m=i;b.a(w,function(b,c){var a=!z&&y||h<=j?w[w.length-c-1]:b;a.H(m-A)});j=h;z=e;a.Pb(r,q)}}}function F(a,b,e){b&&a.$Shift(f);if(!e){d=c.min(d,a.Qb()+A);f=c.max(f,a.ob()+A)}w.push(a)}var r=i.requestAnimationFrame||i.webkitRequestAnimationFrame||i.mozRequestAnimationFrame||i.msRequestAnimationFrame;if(b.kf()&&b.Sd()<7)r=h;r=r||function(a){b.$Delay(a,g.$Interval)};function L(){if(q){var d=b.U(),e=c.min(d-C,g.ne),a=j+e*o;C=d;if(a*o>=n*o)a=n;u(a);if(!v&&a*o>=n*o)N(D);else r(L)}}function t(g,h,i){if(!q){q=e;v=i;D=h;g=c.max(g,d);g=c.min(g,f);n=g;o=n<j?-1:1;a.qe();C=b.U();r(L)}}function N(b){if(q){v=q=D=k;a.ie();b&&b()}}a.$Play=function(a,b,c){t(a?j+a:f,b,c)};a.te=t;a.nb=N;a.Ae=function(a){t(a)};a.ib=function(){return j};a.Od=function(){return n};a.wb=function(){return m};a.H=u;a.af=function(){u(f,e)};a.$Move=function(a){u(j+a)};a.$IsPlaying=function(){return q};a.Ie=function(a){p=a};a.$Shift=Q;a.N=function(a,b){F(a,0,b)};a.Ec=function(a){F(a,1)};a.le=function(a){f+=a};a.Qb=function(){return d};a.ob=function(){return f};a.Pb=a.qe=a.ie=a.Jc=b.Dd;a.yc=b.U();g=b.p({$Interval:16,ne:50},g);p=g.xc;y=g.We;x=g.Ne;d=l=B;f=B+E;J=g.$Round||{};H=g.$During||{};I=b.rc(g.$Easing)};var o=i.$JssorSlideshowFormations$=new function(){var h=this,b=0,a=1,f=2,d=3,s=1,r=2,t=4,q=8,w=256,x=512,v=1024,u=2048,j=u+s,i=u+r,o=x+s,m=x+r,n=w+t,k=w+q,l=v+t,p=v+q;function y(a){return(a&r)==r}function z(a){return(a&t)==t}function g(b,a,c){c.push(a);b[a]=b[a]||[];b[a].push(c)}h.$FormationStraight=function(f){for(var d=f.$Cols,e=f.$Rows,s=f.$Assembly,t=f.nc,r=[],a=0,b=0,p=d-1,q=e-1,h=t-1,c,b=0;b<e;b++)for(a=0;a<d;a++){switch(s){case j:c=h-(a*e+(q-b));break;case l:c=h-(b*d+(p-a));break;case o:c=h-(a*e+b);case n:c=h-(b*d+a);break;case i:c=a*e+b;break;case k:c=b*d+(p-a);break;case m:c=a*e+(q-b);break;default:c=b*d+a}g(r,c,[b,a])}return r};h.$FormationSwirl=function(q){var x=q.$Cols,y=q.$Rows,B=q.$Assembly,w=q.nc,A=[],z=[],u=0,c=0,h=0,r=x-1,s=y-1,t,p,v=0;switch(B){case j:c=r;h=0;p=[f,a,d,b];break;case l:c=0;h=s;p=[b,d,a,f];break;case o:c=r;h=s;p=[d,a,f,b];break;case n:c=r;h=s;p=[a,d,b,f];break;case i:c=0;h=0;p=[f,b,d,a];break;case k:c=r;h=0;p=[a,f,b,d];break;case m:c=0;h=s;p=[d,b,f,a];break;default:c=0;h=0;p=[b,f,a,d]}u=0;while(u<w){t=h+","+c;if(c>=0&&c<x&&h>=0&&h<y&&!z[t]){z[t]=e;g(A,u++,[h,c])}else switch(p[v++%p.length]){case b:c--;break;case f:h--;break;case a:c++;break;case d:h++}switch(p[v%p.length]){case b:c++;break;case f:h++;break;case a:c--;break;case d:h--}}return A};h.$FormationZigZag=function(p){var w=p.$Cols,x=p.$Rows,z=p.$Assembly,v=p.nc,t=[],u=0,c=0,e=0,q=w-1,r=x-1,y,h,s=0;switch(z){case j:c=q;e=0;h=[f,a,d,a];break;case l:c=0;e=r;h=[b,d,a,d];break;case o:c=q;e=r;h=[d,a,f,a];break;case n:c=q;e=r;h=[a,d,b,d];break;case i:c=0;e=0;h=[f,b,d,b];break;case k:c=q;e=0;h=[a,f,b,f];break;case m:c=0;e=r;h=[d,b,f,b];break;default:c=0;e=0;h=[b,f,a,f]}u=0;while(u<v){y=e+","+c;if(c>=0&&c<w&&e>=0&&e<x&&typeof t[y]=="undefined"){g(t,u++,[e,c]);switch(h[s%h.length]){case b:c++;break;case f:e++;break;case a:c--;break;case d:e--}}else{switch(h[s++%h.length]){case b:c--;break;case f:e--;break;case a:c++;break;case d:e++}switch(h[s++%h.length]){case b:c++;break;case f:e++;break;case a:c--;break;case d:e--}}}return t};h.$FormationStraightStairs=function(q){var u=q.$Cols,v=q.$Rows,e=q.$Assembly,t=q.nc,r=[],s=0,c=0,d=0,f=u-1,h=v-1,x=t-1;switch(e){case j:case m:case o:case i:var a=0,b=0;break;case k:case l:case n:case p:var a=f,b=0;break;default:e=p;var a=f,b=0}c=a;d=b;while(s<t){if(z(e)||y(e))g(r,x-s++,[d,c]);else g(r,s++,[d,c]);switch(e){case j:case m:c--;d++;break;case o:case i:c++;d--;break;case k:case l:c--;d--;break;case p:case n:default:c++;d++}if(c<0||d<0||c>f||d>h){switch(e){case j:case m:a++;break;case k:case l:case o:case i:b++;break;case p:case n:default:a--}if(a<0||b<0||a>f||b>h){switch(e){case j:case m:a=f;b++;break;case o:case i:b=h;a++;break;case k:case l:b=h;a--;break;case p:case n:default:a=0;b++}if(b>h)b=h;else if(b<0)b=0;else if(a>f)a=f;else if(a<0)a=0}d=b;c=a}}return r};h.$FormationSquare=function(i){var a=i.$Cols||1,b=i.$Rows||1,j=[],d,e,f,h,k;f=a<b?(b-a)/2:0;h=a>b?(a-b)/2:0;k=c.round(c.max(a/2,b/2))+1;for(d=0;d<a;d++)for(e=0;e<b;e++)g(j,k-c.min(d+1+f,e+1+h,a-d+f,b-e+h),[e,d]);return j};h.$FormationRectangle=function(f){var d=f.$Cols||1,e=f.$Rows||1,h=[],a,b,i;i=c.round(c.min(d/2,e/2))+1;for(a=0;a<d;a++)for(b=0;b<e;b++)g(h,i-c.min(a+1,b+1,d-a,e-b),[b,a]);return h};h.$FormationRandom=function(d){for(var e=[],a,b=0;b<d.$Rows;b++)for(a=0;a<d.$Cols;a++)g(e,c.ceil(1e5*c.random())%13,[b,a]);return e};h.$FormationCircle=function(d){for(var e=d.$Cols||1,f=d.$Rows||1,h=[],a,i=e/2-.5,j=f/2-.5,b=0;b<e;b++)for(a=0;a<f;a++)g(h,c.round(c.sqrt(c.pow(b-i,2)+c.pow(a-j,2))),[a,b]);return h};h.$FormationCross=function(d){for(var e=d.$Cols||1,f=d.$Rows||1,h=[],a,i=e/2-.5,j=f/2-.5,b=0;b<e;b++)for(a=0;a<f;a++)g(h,c.round(c.min(c.abs(b-i),c.abs(a-j))),[a,b]);return h};h.$FormationRectangleCross=function(f){for(var h=f.$Cols||1,i=f.$Rows||1,j=[],a,d=h/2-.5,e=i/2-.5,k=c.max(d,e)+1,b=0;b<h;b++)for(a=0;a<i;a++)g(j,c.round(k-c.max(d-c.abs(b-d),e-c.abs(a-e)))-1,[a,b]);return j}};i.$JssorSlideshowRunner$=function(n,s,q,u,z){var f=this,v,g,a,y=0,x=u.$TransitionsOrder,r,i=8;function t(a){if(a.$Top)a.L=a.$Top;if(a.$Left)a.G=a.$Left;b.a(a,function(a){b.Yc(a)&&t(a)})}function j(g,f){var a={$Interval:f,$Duration:1,$Delay:0,$Cols:1,$Rows:1,$Opacity:0,$Zoom:0,$Clip:0,$Move:k,$SlideOut:k,$Reverse:k,$Formation:o.$FormationRandom,$Assembly:1032,$ChessMode:{$Column:0,$Row:0},$Easing:d.$Swing,$Round:{},hc:[],$During:{}};b.p(a,g);t(a);a.nc=a.$Cols*a.$Rows;a.$Easing=b.rc(a.$Easing,d.$Swing);a.Le=c.ceil(a.$Duration/a.$Interval);a.Ye=function(c,b){c/=a.$Cols;b/=a.$Rows;var f=c+"x"+b;if(!a.hc[f]){a.hc[f]={Q:c,S:b};for(var d=0;d<a.$Cols;d++)for(var e=0;e<a.$Rows;e++)a.hc[f][e+","+d]={$Top:e*b,$Right:d*c+c,$Bottom:e*b+b,$Left:d*c}}return a.hc[f]};if(a.$Brother){a.$Brother=j(a.$Brother,f);a.$SlideOut=e}return a}function p(B,i,a,w,o,m){var z=this,u,v={},j={},n=[],f,d,s,q=a.$ChessMode.$Column||0,r=a.$ChessMode.$Row||0,g=a.Ye(o,m),p=C(a),D=p.length-1,t=a.$Duration+a.$Delay*D,x=w+t,l=a.$SlideOut,y;x+=50;function C(a){var b=a.$Formation(a);return a.$Reverse?b.reverse():b}z.Ud=x;z.lc=function(d){d-=w;var e=d<t;if(e||y){y=e;if(!l)d=t-d;var f=c.ceil(d/a.$Interval);b.a(j,function(a,e){var d=c.max(f,a.ye);d=c.min(d,a.length-1);if(a.Qd!=d){if(!a.Qd&&!l)b.z(n[e]);else d==a.Ee&&l&&b.R(n[e]);a.Qd=d;b.O(n[e],a[d])}})}};i=b.Y(i);b.qb(i,h);if(b.dc()){var E=!i["no-image"],A=b.kg(i);b.a(A,function(a){(E||a["jssor-slider"])&&b.Ab(a,b.Ab(a),e)})}b.a(p,function(h,i){b.a(h,function(G){var K=G[0],J=G[1],t=K+","+J,n=k,p=k,x=k;if(q&&J%2){if(q&3)n=!n;if(q&12)p=!p;if(q&16)x=!x}if(r&&K%2){if(r&3)n=!n;if(r&12)p=!p;if(r&16)x=!x}a.$Top=a.$Top||a.$Clip&4;a.$Bottom=a.$Bottom||a.$Clip&8;a.$Left=a.$Left||a.$Clip&1;a.$Right=a.$Right||a.$Clip&2;var C=p?a.$Bottom:a.$Top,z=p?a.$Top:a.$Bottom,B=n?a.$Right:a.$Left,A=n?a.$Left:a.$Right;a.$Clip=C||z||B||A;s={};d={L:0,G:0,$Opacity:1,Q:o,S:m};f=b.p({},d);u=b.p({},g[t]);if(a.$Opacity)d.$Opacity=2-a.$Opacity;if(a.$ZIndex){d.$ZIndex=a.$ZIndex;f.$ZIndex=0}var I=a.$Cols*a.$Rows>1||a.$Clip;if(a.$Zoom||a.$Rotate){var H=e;if(b.dc())if(a.$Cols*a.$Rows>1)H=k;else I=k;if(H){d.$Zoom=a.$Zoom?a.$Zoom-1:1;f.$Zoom=1;if(b.dc()||b.Pd())d.$Zoom=c.min(d.$Zoom,2);var N=a.$Rotate||0;d.$Rotate=N*360*(x?-1:1);f.$Rotate=0}}if(I){var h=u.Sb={};if(a.$Clip){var w=a.$ScaleClip||1;if(C&&z){h.$Top=g.S/2*w;h.$Bottom=-h.$Top}else if(C)h.$Bottom=-g.S*w;else if(z)h.$Top=g.S*w;if(B&&A){h.$Left=g.Q/2*w;h.$Right=-h.$Left}else if(B)h.$Right=-g.Q*w;else if(A)h.$Left=g.Q*w}s.$Clip=u;f.$Clip=g[t]}var L=n?1:-1,M=p?1:-1;if(a.x)d.G+=o*a.x*L;if(a.y)d.L+=m*a.y*M;b.a(d,function(a,c){if(b.cc(a))if(a!=f[c])s[c]=a-f[c]});v[t]=l?f:d;var D=a.Le,y=c.round(i*a.$Delay/a.$Interval);j[t]=new Array(y);j[t].ye=y;j[t].Ee=y+D-1;for(var F=0;F<=D;F++){var E=b.de(f,s,F/D,a.$Easing,a.$During,a.$Round,{$Move:a.$Move,$OriginalWidth:o,$OriginalHeight:m});E.$ZIndex=E.$ZIndex||1;j[t].push(E)}})});p.reverse();b.a(p,function(a){b.a(a,function(c){var f=c[0],e=c[1],d=f+","+e,a=i;if(e||f)a=b.Y(i);b.O(a,v[d]);b.jb(a,"hidden");b.A(a,"absolute");B.De(a);n[d]=a;b.z(a,!l)})})}function w(){var b=this,c=0;l.call(b,0,v);b.Pb=function(d,b){if(b-c>i){c=b;a&&a.lc(b);g&&g.lc(b)}};b.Lc=r}f.He=function(){var a=0,b=u.$Transitions,d=b.length;if(x)a=y++%d;else a=c.floor(c.random()*d);b[a]&&(b[a].rb=a);return b[a]};f.Xe=function(w,x,k,l,b){r=b;b=j(b,i);var h=l.ad,e=k.ad;h["no-image"]=!l.Zb;e["no-image"]=!k.Zb;var m=h,o=e,u=b,d=b.$Brother||j({},i);if(!b.$SlideOut){m=e;o=h}var t=d.$Shift||0;g=new p(n,o,d,c.max(t-d.$Interval,0),s,q);a=new p(n,m,u,c.max(d.$Interval-t,0),s,q);g.lc(0);a.lc(0);v=c.max(g.Ud,a.Ud);f.rb=w};f.xb=function(){n.xb();g=h;a=h};f.Ze=function(){var b=h;if(a)b=new w;return b};if(b.dc()||b.Pd()||z&&b.rf()<537)i=16;m.call(f);l.call(f,-1e7,1e7)};var j=i.$JssorSlider$=function(q,hc){var o=this;function Fc(){var a=this;l.call(a,-1e8,2e8);a.Te=function(){var b=a.wb(),d=c.floor(b),f=t(d),e=b-c.floor(b);return{rb:f,Se:d,Eb:e}};a.Pb=function(b,a){var d=c.floor(a);if(d!=a&&a>b)d++;Wb(d,e);o.m(j.$EVT_POSITION_CHANGE,t(a),t(b),a,b)}}function Ec(){var a=this;l.call(a,0,0,{xc:r});b.a(A,function(b){D&1&&b.Ie(r);a.Ec(b);b.$Shift(gb/dc)})}function Dc(){var a=this,b=Vb.$Elmt;l.call(a,-1,2,{$Easing:d.$Linear,Ne:{Eb:bc},xc:r},b,{Eb:1},{Eb:-2});a.bc=b}function rc(n,m){var b=this,d,f,g,i,c;l.call(b,-1e8,2e8,{ne:100});b.qe=function(){P=e;R=h;o.m(j.$EVT_SWIPE_START,t(w.ib()),w.ib())};b.ie=function(){P=k;i=k;var a=w.Te();o.m(j.$EVT_SWIPE_END,t(w.ib()),w.ib());!a.Eb&&Hc(a.Se,s)};b.Pb=function(j,h){var b;if(i)b=c;else{b=f;if(g){var e=h/g;b=a.$SlideEasing(e)*(f-d)+d}}w.H(b)};b.Ub=function(a,e,c,h){d=a;f=e;g=c;w.H(a);b.H(0);b.te(c,h)};b.Uf=function(a){i=e;c=a;b.$Play(a,h,e)};b.Yf=function(a){c=a};w=new Fc;w.N(n);w.N(m)}function sc(){var c=this,a=Zb();b.I(a,0);b.T(a,"pointerEvents","none");c.$Elmt=a;c.De=function(c){b.J(a,c);b.z(a)};c.xb=function(){b.R(a);b.Ac(a)}}function Bc(n,g){var d=this,v,P,y,p,C=[],x,F,Y,M,W,E,O,i,w,q;l.call(d,-u,u+1,{});function G(a){v&&v.gd();X(n,a,0);E=e;v=new J.$Class(n,J,b.Ce(b.j(n,"idle"))||qc,!I);v.H(0)}function ab(){v.yc<J.yc&&G()}function S(n,r,m){if(!M){M=e;if(p&&m){var f=m.width,c=m.height,l=f,i=c;if(f&&c&&a.$FillMode){if(a.$FillMode&3&&(!(a.$FillMode&4)||f>L||c>K)){var h=k,q=L/K*c/f;if(a.$FillMode&1)h=q>1;else if(a.$FillMode&2)h=q<1;l=h?f*K/c:L;i=h?K:c*L/f}b.l(p,l);b.n(p,i);b.B(p,(K-i)/2);b.C(p,(L-l)/2)}b.A(p,"absolute");o.m(j.$EVT_LOAD_END,g)}}b.R(r);n&&n(d)}function Z(b,c,e,f){if(f==R&&s==g&&I)if(!Gc){var a=t(b);B.Xe(a,g,c,d,e);c.Qf();U.$Shift(a-U.Qb()-1);U.H(a);z.Ub(b,b,0)}}function eb(b){if(b==R&&s==g){if(!i){var a=h;if(B)if(B.rb==g)a=B.Ze();else B.xb();ab();i=new zc(n,g,a,v);i.wd(q)}!i.$IsPlaying()&&i.pc()}}function H(e,f,l){if(e==g){if(e!=f)A[f]&&A[f].Wc();else!l&&i&&i.jg();q&&q.$Enable();var m=R=b.U();d.Gb(b.K(h,eb,m))}else{var k=c.min(g,e),j=c.max(g,e),o=c.min(j-k,k+r-j),n=u+a.$LazyLoading-1;(!W||o<=n)&&d.Gb()}}function fb(){if(s==g&&i){i.nb();q&&q.$Quit();q&&q.$Disable();i.dd()}}function gb(){s==g&&i&&i.nb()}function bb(a){!N&&o.m(j.$EVT_CLICK,g,a)}function T(){q=w.pInstance;i&&i.wd(q)}d.Gb=function(c,a){a=a||y;if(C.length&&!M){b.z(a);if(!Y){Y=e;o.m(j.$EVT_LOAD_START,g);b.a(C,function(a){if(!b.v(a,"src")){a.src=b.j(a,"src2")||"";b.db(a,a["display-origin"])}})}b.Ue(C,p,b.K(h,S,c,a))}else S(c,a)};d.ig=function(){var j=g;if(a.$AutoPlaySteps<0)j-=r;var e=j+a.$AutoPlaySteps*xc;if(D&2)e=t(e);if(!(D&1)&&!db)e=c.max(0,c.min(e,r-u));if(e!=g){if(B){var f=B.He(r);if(f){var k=R=b.U(),i=A[t(e)];return i.Gb(b.K(h,Z,e,i,f,k),y)}}ob(e)}else if(a.$Loop){d.Wc();H(g,g)}};d.Cc=function(){H(g,g,e)};d.Wc=function(){q&&q.$Quit();q&&q.$Disable();d.xe();i&&i.mf();i=h;G()};d.Qf=function(){b.R(n)};d.xe=function(){b.z(n)};d.sf=function(){q&&q.$Enable()};function X(a,g,c,d){if(b.v(a,"jssor-slider"))return;if(!E){if(a.tagName=="IMG"){C.push(a);if(!b.v(a,"src")){W=e;a["display-origin"]=b.db(a);b.R(a)}}var h=b.Ke(a);if(h){var i=new Image;b.j(i,"src2",h);C.push(i)}if(c){b.I(a,(b.I(a)||0)+1);b.wc(a,b.wc(a)||0);b.uc(a,b.uc(a)||0);b.qb(a,{$TranslateZ:0})}d=d||a.style.pointerEvents||b.oc(a)}var j=b.Kb(a);b.a(j,function(f){var i=f.tagName,j=b.j(f,"u");if(j=="player"&&!w){w=f;if(w.pInstance)T();else b.f(w,"dataavailable",T)}if(j=="caption"){if(g){b.he(f,b.j(f,"to"));b.of(f,b.j(f,"bf"));O&&b.j(f,"3d")&&b.nf(f,"preserve-3d")}else if(!b.Md()){var h=b.Y(f,k,e);b.ec(h,f,a);b.Fb(f,a);f=h;g=e}}else if(!E&&!c&&!p){if(i=="A"){if(b.j(f,"u")=="image")p=b.lg(f,"IMG");else p=b.u(f,"image",e);if(p){x=f;b.db(x,"block");b.O(x,V);F=b.Y(x,e);b.A(x,"relative");b.Ab(F,0);b.T(F,"backgroundColor","#000")}}else if(i=="IMG"&&b.j(f,"u")=="image")p=f;if(p){p.border=0;b.O(p,V)}}X(f,g,c+1,d)});if(!E&&c)!d&&b.T(a,"pointerEvents",a.tagName=="A"?"all":c>1?f:"none")}d.Jc=function(c,b){var a=u-b;bc(P,a)};d.rb=g;m.call(d);O=b.j(n,"p");b.Kf(n,O);b.bg(n,b.j(n,"po"));var Q=b.u(n,"thumb",e);if(Q){d.qf=b.Y(Q);b.R(Q)}b.z(n);y=b.Y(cb);b.I(y,1e3);b.f(n,"click",bb);G(e);d.Zb=p;d.Ld=F;d.ad=n;d.bc=P=n;b.J(P,y);o.$On(203,H);o.$On(28,gb);o.$On(24,fb)}function zc(y,f,p,q){var a=this,m=0,u=0,g,h,d,c,i,t,r,n=A[f];l.call(a,0,0);function v(){b.Ac(O);fc&&i&&n.Ld&&b.J(O,n.Ld);b.z(O,!i&&n.Zb)}function w(){a.pc()}function x(b){r=b;a.nb();a.pc()}a.pc=function(){var b=a.wb();if(!C&&!P&&!r&&s==f){if(!b){if(g&&!i){i=e;a.dd(e);o.m(j.$EVT_SLIDESHOW_START,f,m,u,g,c)}v()}var k,p=j.$EVT_STATE_CHANGE;if(b!=c)if(b==d)k=c;else if(b==h)k=d;else if(!b)k=h;else k=a.Od();o.m(p,f,b,m,h,d,c);var l=I&&(!E||F);if(b==c)(d!=c&&!(E&12)||l)&&n.ig();else(l||b!=d)&&a.te(k,w)}};a.jg=function(){d==c&&d==a.wb()&&a.H(h)};a.mf=function(){B&&B.rb==f&&B.xb();var b=a.wb();b<c&&o.m(j.$EVT_STATE_CHANGE,f,-b-1,m,h,d,c)};a.dd=function(a){p&&b.jb(ib,a&&p.Lc.$Outside?"":"hidden")};a.Jc=function(b,a){if(i&&a>=g){i=k;v();n.xe();B.xb();o.m(j.$EVT_SLIDESHOW_END,f,m,u,g,c)}o.m(j.$EVT_PROGRESS_CHANGE,f,a,m,h,d,c)};a.wd=function(a){if(a&&!t){t=a;a.$On($JssorPlayer$.Ge,x)}};p&&a.Ec(p);g=a.ob();a.Ec(q);h=g+q.Xd;c=a.ob();d=I?g+q.pe:c}function Mb(a,c,d){b.C(a,c);b.B(a,d)}function bc(c,b){var a=x>0?x:hb,d=Bb*b*(a&1),e=Cb*b*(a>>1&1);Mb(c,d,e)}function Rb(){qb=P;Kb=z.Od();G=w.ib()}function ic(){Rb();if(C||!F&&E&12){z.nb();o.m(j.jf)}}function gc(f){if(!C&&(F||!(E&12))&&!z.$IsPlaying()){var d=w.ib(),b=c.ceil(G);if(f&&c.abs(H)>=a.$MinDragOffsetToSlide){b=c.ceil(d);b+=fb}if(!(D&1))b=c.min(r-u,c.max(b,0));var e=c.abs(b-d);e=1-c.pow(1-e,5);if(!N&&qb)z.Ae(Kb);else if(d==b){ub.sf();ub.Cc()}else z.Ub(d,b,e*Xb)}}function Ib(a){!b.j(b.Dc(a),"nodrag")&&b.Tb(a)}function vc(a){ac(a,1)}function ac(a,c){a=b.re(a);var i=b.Dc(a);if(!M&&!b.j(i,"nodrag")&&wc()&&(!c||a.touches.length==1)){C=e;Ab=k;R=h;b.f(g,c?"touchmove":"mousemove",Db);b.U();N=0;ic();if(!qb)x=0;if(c){var f=a.touches[0];vb=f.clientX;wb=f.clientY}else{var d=b.ve(a);vb=d.x;wb=d.y}H=0;bb=0;fb=0;o.m(j.$EVT_DRAG_START,t(G),G,a)}}function Db(d){if(C){d=b.re(d);var f;if(d.type!="mousemove"){var l=d.touches[0];f={x:l.clientX,y:l.clientY}}else f=b.ve(d);if(f){var j=f.x-vb,k=f.y-wb;if(c.floor(G)!=G)x=x||hb&M;if((j||k)&&!x){if(M==3)if(c.abs(k)>c.abs(j))x=2;else x=1;else x=M;if(kb&&x==1&&c.abs(k)-c.abs(j)>3)Ab=e}if(x){var a=k,i=Cb;if(x==1){a=j;i=Bb}if(!(D&1)){if(a>0){var g=i*s,h=a-g;if(h>0)a=g+c.sqrt(h)*5}if(a<0){var g=i*(r-u-s),h=-a-g;if(h>0)a=-g-c.sqrt(h)*5}}if(H-bb<-2)fb=0;else if(H-bb>2)fb=-1;bb=H;H=a;tb=G-H/i/(Z||1);if(H&&x&&!Ab){b.Tb(d);if(!P)z.Uf(tb);else z.Yf(tb)}}}}}function nb(){tc();if(C){C=k;b.U();b.P(g,"mousemove",Db);b.P(g,"touchmove",Db);N=H;z.nb();var a=w.ib();o.m(j.$EVT_DRAG_END,t(a),a,t(G),G);E&12&&Rb();gc(e)}}function mc(c){if(N){b.hg(c);var a=b.Dc(c);while(a&&v!==a){a.tagName=="A"&&b.Tb(c);try{a=a.parentNode}catch(d){break}}}}function Lb(a){A[s];s=t(a);ub=A[s];Wb(a);return s}function Hc(a,b){x=0;Lb(a);o.m(j.$EVT_PARK,t(a),b)}function Wb(a,c){yb=a;b.a(S,function(b){b.Pc(t(a),a,c)})}function wc(){var b=j.Yd||0,a=Y;if(kb)a&1&&(a&=1);j.Yd|=a;return M=a&~b}function tc(){if(M){j.Yd&=~Y;M=0}}function Zb(){var a=b.vb();b.O(a,V);b.A(a,"absolute");return a}function t(a){return(a%r+r)%r}function nc(b,d){if(d)if(!D){b=c.min(c.max(b+yb,0),r-u);d=k}else if(D&2){b=t(b+yb);d=k}ob(b,a.$SlideDuration,d)}function zb(){b.a(S,function(a){a.Ic(a.Rb.$ChanceToShow<=F)})}function kc(){if(!F){F=1;zb();if(!C){E&12&&gc();E&3&&A[s]&&A[s].Cc()}}}function jc(){if(F){F=0;zb();C||!(E&12)||ic()}}function lc(){V={Q:L,S:K,$Top:0,$Left:0};b.a(T,function(a){b.O(a,V);b.A(a,"absolute");b.jb(a,"hidden");b.R(a)});b.O(cb,V)}function mb(b,a){ob(b,a,e)}function ob(h,g,l){if(Tb&&(!C&&(F||!(E&12))||a.$NaviQuitDrag)){P=e;C=k;z.nb();if(g==f)g=Xb;var d=Eb.wb(),b=h;if(l){b=d+h;if(h>0)b=c.ceil(b);else b=c.floor(b)}if(D&2)b=t(b);if(!(D&1))b=c.max(0,c.min(b,r-u));var j=(b-d)%r;b=d+j;var i=d==b?0:g*c.abs(j);i=c.min(i,g*u*1.5);z.Ub(d,b,i||1)}}o.$PlayTo=ob;o.$GoTo=function(a){w.H(Lb(a))};o.$Next=function(){mb(1)};o.$Prev=function(){mb(-1)};o.$Pause=function(){I=k};o.$Play=function(){if(!I){I=e;A[s]&&A[s].Cc()}};o.$SetSlideshowTransitions=function(b){a.$SlideshowOptions.$Transitions=b};o.$SetCaptionTransitions=function(a){J.$Transitions=a;J.yc=b.U()};o.$SlidesCount=function(){return T.length};o.$CurrentIndex=function(){return s};o.$IsAutoPlaying=function(){return I};o.$IsDragging=function(){return C};o.$IsSliding=function(){return P};o.$IsMouseOver=function(){return!F};o.$LastDragSucceded=function(){return N};function X(){return b.l(y||q)}function jb(){return b.n(y||q)}o.$OriginalWidth=o.$GetOriginalWidth=X;o.$OriginalHeight=o.$GetOriginalHeight=jb;function Gb(c,d){if(c==f)return b.l(q);if(!y){var a=b.vb(g);b.oc(a,b.oc(q));b.fc(a,b.fc(q));b.db(a,"block");b.A(a,"relative");b.B(a,0);b.C(a,0);b.jb(a,"visible");y=b.vb(g);b.A(y,"absolute");b.B(y,0);b.C(y,0);b.l(y,b.l(q));b.n(y,b.n(q));b.he(y,"0 0");b.J(y,a);var i=b.Kb(q);b.J(q,y);b.T(q,"backgroundImage","");b.a(i,function(c){b.J(b.j(c,"noscale")?q:a,c);b.j(c,"autocenter")&&Nb.push(c)})}Z=c/(d?b.n:b.l)(y);b.gg(y,Z);var h=d?Z*X():c,e=d?c:Z*jb();b.l(q,h);b.n(q,e);b.a(Nb,function(a){var c=b.Nb(b.j(a,"autocenter"));b.Rf(a,c)})}o.$ScaleHeight=o.$GetScaleHeight=function(a){if(a==f)return b.n(q);Gb(a,e)};o.$ScaleWidth=o.$SetScaleWidth=o.$GetScaleWidth=Gb;o.be=function(a){var d=c.ceil(t(gb/dc)),b=t(a-s+d);if(b>u){if(a-s>r/2)a-=r;else if(a-s<=-r/2)a+=r}else a=s+b-d;return a};m.call(o);o.$Elmt=q=b.pb(q);var a=b.p({$FillMode:0,$LazyLoading:1,$ArrowKeyNavigation:1,$StartIndex:0,$AutoPlay:k,$Loop:1,$HWA:e,$NaviQuitDrag:e,$AutoPlaySteps:1,$AutoPlayInterval:3e3,$PauseOnHover:1,$SlideDuration:500,$SlideEasing:d.$OutQuad,$MinDragOffsetToSlide:20,$SlideSpacing:0,$Cols:1,$Align:0,$UISearchMode:1,$PlayOrientation:1,$DragOrientation:1},hc);a.$HWA=a.$HWA&&b.pf();if(a.$Idle!=f)a.$AutoPlayInterval=a.$Idle;if(a.$ParkingPosition!=f)a.$Align=a.$ParkingPosition;var hb=a.$PlayOrientation&3,xc=(a.$PlayOrientation&4)/-4||1,eb=a.$SlideshowOptions,J=b.p({$Class:p,$PlayInMode:1,$PlayOutMode:1,$HWA:a.$HWA},a.$CaptionSliderOptions);J.$Transitions=J.$Transitions||J.$CaptionTransitions;var rb=a.$BulletNavigatorOptions,W=a.$ArrowNavigatorOptions,ab=a.$ThumbnailNavigatorOptions,Q=!a.$UISearchMode,y,v=b.u(q,"slides",Q),cb=b.u(q,"loading",Q)||b.vb(g),Jb=b.u(q,"navigator",Q),ec=b.u(q,"arrowleft",Q),cc=b.u(q,"arrowright",Q),Hb=b.u(q,"thumbnavigator",Q),pc=b.l(v),oc=b.n(v),V,T=[],yc=b.Kb(v);b.a(yc,function(a){a.tagName=="DIV"&&!b.j(a,"u")&&T.push(a);b.I(a,(b.I(a)||0)+1)});var s=-1,yb,ub,r=T.length,L=a.$SlideWidth||pc,K=a.$SlideHeight||oc,Yb=a.$SlideSpacing,Bb=L+Yb,Cb=K+Yb,dc=hb&1?Bb:Cb,u=c.min(a.$Cols,r),ib,x,M,Ab,S=[],Sb,Ub,Qb,fc,Gc,I,E=a.$PauseOnHover,qc=a.$AutoPlayInterval,Xb=a.$SlideDuration,sb,db,gb,Tb=u<r,D=Tb?a.$Loop:0,Y,N,F=1,P,C,R,vb=0,wb=0,H,bb,fb,Eb,w,U,z,Vb=new sc,Z,Nb=[];if(r){if(a.$HWA)Mb=function(a,c,d){b.qb(a,{$TranslateX:c,$TranslateY:d})};I=a.$AutoPlay;o.Rb=hc;lc();b.v(q,"jssor-slider",e);b.I(v,b.I(v)||0);b.A(v,"absolute");ib=b.Y(v,e);b.ec(ib,v);if(eb){fc=eb.$ShowLink;sb=eb.$Class;db=u==1&&r>1&&sb&&(!b.Md()||b.Sd()>=8)}gb=db||u>=r||!(D&1)?0:a.$Align;Y=(u>1||gb?hb:-1)&a.$DragOrientation;var xb=v,A=[],B,O,Fb=b.ef(),kb=Fb.cf,G,qb,Kb,tb;Fb.Wd&&b.T(xb,Fb.Wd,([h,"pan-y","pan-x","none"])[Y]||"");U=new Dc;if(db)B=new sb(Vb,L,K,eb,kb);b.J(ib,U.bc);b.jb(v,"hidden");O=Zb();b.T(O,"backgroundColor","#000");b.Ab(O,0);b.ec(O,xb.firstChild,xb);for(var pb=0;pb<T.length;pb++){var Ac=T[pb],Cc=new Bc(Ac,pb);A.push(Cc)}b.R(cb);Eb=new Ec;z=new rc(Eb,U);b.f(v,"click",mc,e);b.f(q,"mouseout",b.Wb(kc,q));b.f(q,"mouseover",b.Wb(jc,q));if(Y){b.f(v,"mousedown",ac);b.f(v,"touchstart",vc);b.f(v,"dragstart",Ib);b.f(v,"selectstart",Ib);b.f(g,"mouseup",nb);b.f(g,"touchend",nb);b.f(g,"touchcancel",nb);b.f(i,"blur",nb)}E&=kb?10:5;if(Jb&&rb){Sb=new rb.$Class(Jb,rb,X(),jb());S.push(Sb)}if(W&&ec&&cc){W.$Loop=D;W.$Cols=u;Ub=new W.$Class(ec,cc,W,X(),jb());S.push(Ub)}if(Hb&&ab){ab.$StartIndex=a.$StartIndex;Qb=new ab.$Class(Hb,ab);S.push(Qb)}b.a(S,function(a){a.Bc(r,A,cb);a.$On(n.ic,nc)});b.T(q,"visibility","visible");Gb(X());zb();a.$ArrowKeyNavigation&&b.f(g,"keydown",function(b){if(b.keyCode==37)mb(-a.$ArrowKeyNavigation);else b.keyCode==39&&mb(a.$ArrowKeyNavigation)});var lb=a.$StartIndex;if(!(D&1))lb=c.max(0,c.min(lb,r-u));z.Ub(lb,lb,0)}};j.$EVT_CLICK=21;j.$EVT_DRAG_START=22;j.$EVT_DRAG_END=23;j.$EVT_SWIPE_START=24;j.$EVT_SWIPE_END=25;j.$EVT_LOAD_START=26;j.$EVT_LOAD_END=27;j.jf=28;j.$EVT_POSITION_CHANGE=202;j.$EVT_PARK=203;j.$EVT_SLIDESHOW_START=206;j.$EVT_SLIDESHOW_END=207;j.$EVT_PROGRESS_CHANGE=208;j.$EVT_STATE_CHANGE=209;var n={ic:1};i.$JssorBulletNavigator$=function(d,C){var f=this;m.call(f);d=b.pb(d);var s,A,z,r,l=0,a,o,j,w,x,i,g,q,p,B=[],y=[];function v(a){a!=-1&&y[a].qd(a==l)}function t(a){f.m(n.ic,a*o)}f.$Elmt=d;f.Pc=function(a){if(a!=r){var d=l,b=c.floor(a/o);l=b;r=a;v(d);v(b)}};f.Ic=function(a){b.z(d,a)};var u;f.Bc=function(E){if(!u){s=c.ceil(E/o);l=0;var n=q+w,r=p+x,m=c.ceil(s/j)-1;A=q+n*(!i?m:j-1);z=p+r*(i?m:j-1);b.l(d,A);b.n(d,z);for(var f=0;f<s;f++){var C=b.Sf();b.cg(C,f+1);var k=b.od(g,"numbertemplate",C,e);b.A(k,"absolute");var v=f%(m+1);b.C(k,!i?n*v:f%j*n);b.B(k,i?r*v:c.floor(f/(m+1))*r);b.J(d,k);B[f]=k;a.$ActionMode&1&&b.f(k,"click",b.K(h,t,f));a.$ActionMode&2&&b.f(k,"mouseover",b.Wb(b.K(h,t,f),k));y[f]=b.Mb(k)}u=e}};f.Rb=a=b.p({$SpacingX:10,$SpacingY:10,$Orientation:1,$ActionMode:1},C);g=b.u(d,"prototype");q=b.l(g);p=b.n(g);b.Fb(g,d);o=a.$Steps||1;j=a.$Rows||1;w=a.$SpacingX;x=a.$SpacingY;i=a.$Orientation-1;a.$Scale==k&&b.v(d,"noscale",e);a.$AutoCenter&&b.v(d,"autocenter",a.$AutoCenter)};i.$JssorArrowNavigator$=function(a,g,i){var c=this;m.call(c);var r,d,f,j;b.l(a);b.n(a);var p,o;function l(a){c.m(n.ic,a,e)}function t(c){b.z(a,c);b.z(g,c)}function s(){p.$Enable(i.$Loop||d>0);o.$Enable(i.$Loop||d<r-i.$Cols)}c.Pc=function(b,a,c){if(c)d=a;else{d=b;s()}};c.Ic=t;var q;c.Bc=function(c){r=c;d=0;if(!q){b.f(a,"click",b.K(h,l,-j));b.f(g,"click",b.K(h,l,j));p=b.Mb(a);o=b.Mb(g);q=e}};c.Rb=f=b.p({$Steps:1},i);j=f.$Steps;if(f.$Scale==k){b.v(a,"noscale",e);b.v(g,"noscale",e)}if(f.$AutoCenter){b.v(a,"autocenter",f.$AutoCenter);b.v(g,"autocenter",f.$AutoCenter)}};i.$JssorThumbnailNavigator$=function(g,B){var i=this,y,p,a,v=[],z,x,d,q,r,u,t,o,s,f,l;m.call(i);g=b.pb(g);function A(o,f){var g=this,c,m,k;function q(){m.qd(p==f)}function j(e){if(e||!s.$LastDragSucceded()){var a=d-f%d,b=s.be((f+a)/d-1),c=b*d+d-a;i.m(n.ic,c)}}g.rb=f;g.ed=q;k=o.qf||o.Zb||b.vb();g.bc=c=b.od(l,"thumbnailtemplate",k,e);m=b.Mb(c);a.$ActionMode&1&&b.f(c,"click",b.K(h,j,0));a.$ActionMode&2&&b.f(c,"mouseover",b.Wb(b.K(h,j,1),c))}i.Pc=function(b,e,f){var a=p;p=b;a!=-1&&v[a].ed();v[b].ed();!f&&s.$PlayTo(s.be(c.floor(e/d)))};i.Ic=function(a){b.z(g,a)};var w;i.Bc=function(F,D){if(!w){y=F;c.ceil(y/d);p=-1;o=c.min(o,D.length);var h=a.$Orientation&1,m=u+(u+q)*(d-1)*(1-h),l=t+(t+r)*(d-1)*h,B=m+(m+q)*(o-1)*h,n=l+(l+r)*(o-1)*(1-h);b.A(f,"absolute");b.jb(f,"hidden");a.$AutoCenter&1&&b.C(f,(z-B)/2);a.$AutoCenter&2&&b.B(f,(x-n)/2);b.l(f,B);b.n(f,n);var i=[];b.a(D,function(l,g){var j=new A(l,g),e=j.bc,a=c.floor(g/d),k=g%d;b.C(e,(u+q)*k*(1-h));b.B(e,(t+r)*k*h);if(!i[a]){i[a]=b.vb();b.J(f,i[a])}b.J(i[a],e);v.push(j)});var E=b.p({$AutoPlay:k,$NaviQuitDrag:k,$SlideWidth:m,$SlideHeight:l,$SlideSpacing:q*h+r*(1-h),$MinDragOffsetToSlide:12,$SlideDuration:200,$PauseOnHover:1,$PlayOrientation:a.$Orientation,$DragOrientation:a.$NoDrag||a.$DisableDrag?0:a.$Orientation},a);s=new j(g,E);w=e}};i.Rb=a=b.p({$SpacingX:0,$SpacingY:0,$Cols:1,$Orientation:1,$AutoCenter:3,$ActionMode:1},B);z=b.l(g);x=b.n(g);f=b.u(g,"slides",e);l=b.u(f,"prototype");u=b.l(l);t=b.n(l);b.Fb(l,f);d=a.$Rows||1;q=a.$SpacingX;r=a.$SpacingY;o=a.$Cols;a.$Scale==k&&b.v(g,"noscale",e)};function p(e,d,c){var a=this;l.call(a,0,c);a.gd=b.Dd;a.Xd=0;a.pe=c}i.$JssorCaptionSlideo$=function(v,j,u,E){var a=this,w,o={},p=j.$Transitions,s=j.$Controls,m=new l(0,0),q=[],g=[],D=E,f=D?1e8:0;l.call(a,0,0);function r(d,c){var a={};b.a(d,function(d,f){var e=o[f];if(e){if(b.Yc(d))d=r(d,c||f=="e");else if(c)if(b.cc(d))d=w[d];a[e]=d}});return a}function t(d,e){var a=[],c=b.Kb(d);b.a(c,function(c){var h=b.j(c,"u")=="caption";if(h){var d=b.j(c,"t"),g=p[b.Nb(d)]||p[d],f={$Elmt:c,Lc:g};a.push(f)}a=a.concat(t(c,e+1))});return a}function n(c,e){var a=q[c];if(a==h){a=q[c]={gb:c,Oc:[],bd:[]};var d=0;!b.a(g,function(a,b){d=b;return a.gb>c})&&d++;g.splice(d,0,a)}return a}function z(t,u,g){var a,d;if(s){var o=b.j(t,"c");if(o){var m=s[b.Nb(o)];if(m){a=n(m.r,0);a.Cf=m.e||0}}}b.a(u,function(i){var h=b.p(e,{},r(i)),j=b.rc(h.$Easing);delete h.$Easing;if(h.$Left){h.G=h.$Left;j.G=j.$Left;delete h.$Left}if(h.$Top){h.L=h.$Top;j.L=j.$Top;delete h.$Top}var o={$Easing:j,$OriginalWidth:g.Q,$OriginalHeight:g.S},k=new l(i.b,i.d,o,t,g,h);f=c.max(f,i.b+i.d);if(a){if(!d)d=new l(i.b,0);d.N(k)}else{var m=n(i.b,i.b+i.d);m.Oc.push(k)}g=b.Ve(g,h)});if(a&&d){d.af();var i=d,k,j=d.Qb(),p=d.ob(),q=c.max(p,a.Cf);if(a.gb<p){if(a.gb>j){i=new l(j,a.gb-j);i.N(d,e)}else i=h;k=new l(a.gb,q-j,{xc:q-a.gb,We:e});k.N(d,e)}i&&a.Oc.push(i);k&&a.bd.push(k)}return g}function y(a){b.a(a,function(f){var a=f.$Elmt,e=b.l(a),d=b.n(a),c={$Left:b.C(a),$Top:b.B(a),G:0,L:0,$Opacity:1,$ZIndex:b.I(a)||0,$Rotate:0,$RotateX:0,$RotateY:0,$ScaleX:1,$ScaleY:1,$TranslateX:0,$TranslateY:0,$TranslateZ:0,$SkewX:0,$SkewY:0,Q:e,S:d,$Clip:{$Top:0,$Right:e,$Bottom:d,$Left:0}};c.me=c.$Left;c.we=c.$Top;z(a,f.Lc,c)})}function B(f,d,g){var c=f.b-d;if(c){var b=new l(d,c);b.N(m,e);b.$Shift(g);a.N(b)}a.le(f.d);return c}function A(e){var c=m.Qb(),d=0;b.a(e,function(e,f){e=b.p({d:u},e);B(e,c,d);c=e.b;d+=e.d;if(!f||e.t==2){a.Xd=c;a.pe=c+e.d}})}function i(k,d,e){var g=d.length;if(g>4)for(var m=c.ceil(g/4),a=0;a<m;a++){var h=d.slice(a*4,c.min(a*4+4,g)),j=new l(h[0].gb,0);i(j,h,e);k.N(j)}else b.a(d,function(a){b.a(e?a.bd:a.Oc,function(a){e&&a.le(f-a.ob());k.N(a)})})}a.gd=function(){a.H(-1,e)};w=[d.$Linear,d.$Swing,d.$InQuad,d.$OutQuad,d.$InOutQuad,d.$InCubic,d.$OutCubic,d.$InOutCubic,d.$InQuart,d.$OutQuart,d.$InOutQuart,d.$InQuint,d.$OutQuint,d.$InOutQuint,d.$InSine,d.$OutSine,d.$InOutSine,d.$InExpo,d.$OutExpo,d.$InOutExpo,d.$InCirc,d.$OutCirc,d.$InOutCirc,d.$InElastic,d.$OutElastic,d.$InOutElastic,d.$InBack,d.$OutBack,d.$InOutBack,d.$InBounce,d.$OutBounce,d.$InOutBounce,d.$Early,d.$Late];var C={$Top:"y",$Left:"x",$Bottom:"m",$Right:"t",$Rotate:"r",$RotateX:"rX",$RotateY:"rY",$ScaleX:"sX",$ScaleY:"sY",$TranslateX:"tX",$TranslateY:"tY",$TranslateZ:"tZ",$SkewX:"kX",$SkewY:"kY",$Opacity:"o",$Easing:"e",$ZIndex:"i",$Clip:"c"};b.a(C,function(b,a){o[b]=a});y(t(v,1));i(m,g);var x=j.$Breaks||[],k=[].concat(x[b.Nb(b.j(v,"b"))]||[]);k.push({b:f,d:k.length?0:u});A(k);f=c.max(f,a.ob());i(a,g,e);a.H(-1)}})(window,document,Math,null,true,false)
var jssor_1_options;
var jsorSlider;

jQuery(document).ready(function ($) {

	var jssor_1_SlideshowTransitions = [
	  //{ $Duration: 1200, x: 0.3, $During: { $Left: [0.3, 0.7] }, $Easing: { $Left: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, x: -0.3, $SlideOut: true, $Easing: { $Left: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, x: -0.3, $During: { $Left: [0.3, 0.7] }, $Easing: { $Left: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, x: 0.3, $SlideOut: true, $Easing: { $Left: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, y: 0.3, $During: { $Top: [0.3, 0.7] }, $Easing: { $Top: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, y: -0.3, $SlideOut: true, $Easing: { $Top: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, y: -0.3, $During: { $Top: [0.3, 0.7] }, $Easing: { $Top: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, y: 0.3, $SlideOut: true, $Easing: { $Top: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, x: 0.3, $Cols: 2, $During: { $Left: [0.3, 0.7] }, $ChessMode: { $Column: 3 }, $Easing: { $Left: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, x: 0.3, $Cols: 2, $SlideOut: true, $ChessMode: { $Column: 3 }, $Easing: { $Left: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, y: 0.3, $Rows: 2, $During: { $Top: [0.3, 0.7] }, $ChessMode: { $Row: 12 }, $Easing: { $Top: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, y: 0.3, $Rows: 2, $SlideOut: true, $ChessMode: { $Row: 12 }, $Easing: { $Top: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, y: 0.3, $Cols: 2, $During: { $Top: [0.3, 0.7] }, $ChessMode: { $Column: 12 }, $Easing: { $Top: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, y: -0.3, $Cols: 2, $SlideOut: true, $ChessMode: { $Column: 12 }, $Easing: { $Top: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, x: 0.3, $Rows: 2, $During: { $Left: [0.3, 0.7] }, $ChessMode: { $Row: 3 }, $Easing: { $Left: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, x: -0.3, $Rows: 2, $SlideOut: true, $ChessMode: { $Row: 3 }, $Easing: { $Left: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, x: 0.3, y: 0.3, $Cols: 2, $Rows: 2, $During: { $Left: [0.3, 0.7], $Top: [0.3, 0.7] }, $ChessMode: { $Column: 3, $Row: 12 }, $Easing: { $Left: $Jease$.$InCubic, $Top: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, x: 0.3, y: 0.3, $Cols: 2, $Rows: 2, $During: { $Left: [0.3, 0.7], $Top: [0.3, 0.7] }, $SlideOut: true, $ChessMode: { $Column: 3, $Row: 12 }, $Easing: { $Left: $Jease$.$InCubic, $Top: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, $Delay: 20, $Clip: 3, $Assembly: 260, $Easing: { $Clip: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, $Delay: 20, $Clip: 3, $SlideOut: true, $Assembly: 260, $Easing: { $Clip: $Jease$.$OutCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  //{ $Duration: 1200, $Delay: 20, $Clip: 12, $Assembly: 260, $Easing: { $Clip: $Jease$.$InCubic, $Opacity: $Jease$.$Linear }, $Opacity: 2 },
	  { $Duration: 100, $Opacity: 2}
	];

	jssor_1_options = {
		$AutoPlay: true,
		$AutoPlayInterval: 1500,
		$SlideshowOptions: {
			$Class: $JssorSlideshowRunner$,
			$Transitions: jssor_1_SlideshowTransitions,
			$TransitionsOrder: 1
		},
		$ArrowNavigatorOptions: {
			$Class: $JssorArrowNavigator$
		},
		$ThumbnailNavigatorOptions: {
			$Class: $JssorThumbnailNavigator$,
			$Cols: 10,
			$SpacingX: 8,
			$SpacingY: 8,
			$Align: 360
		}
	};


	/*responsive code begin*/
	/*remove responsive code if you don't want the slider scales while window resizing*/
	//function ScaleSlider() {
	//	var refSize = jssor_1_slider.$Elmt.parentNode.clientWidth;
	//	if (refSize) {
	//		refSize = Math.min(refSize, 800);
	//		jssor_1_slider.$ScaleWidth(refSize);
	//	}
	//	else {
	//		window.setTimeout(ScaleSlider, 30);
	//	}
	//}
	//ScaleSlider();
	//$(window).bind("load", ScaleSlider);
	//$(window).bind("resize", ScaleSlider);
	//$(window).bind("orientationchange", ScaleSlider);
	/*responsive code end*/
});
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
               //console.log('saving settings on blur of njuskaloEmailForNewAdv');
               settings.email = $('#njuskaloEmailForNewAdv').val();
               saveSettings();
           });
           $('#emailjsUserId').on('blur', function () {
               //console.log('saving settings on blur of emailjsUserId');
               settings.emailJsUserId = $('#emailjsUserId').val();
               saveSettings();
               emailjs.init(settings.emailJSUserId);
           });
           $('#emailjsTemplateId').on('blur', function () {
               //console.log('saving settings on blur of emailjsTemplateId');
               settings.emailJsTemplateId = $('#emailjsTemplateId').val();
               saveSettings();
           });
           $('#njuskaloRefreshInt').on('change', function () {
               //console.log('saving settings on blur of njuskaloRefreshInt');
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
                emailjs.init(settings.emailJSUserId);
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

    $('#emailjsUserId').prev().removeClass('invalidSetting');
    $('#emailjsUserId').removeClass('invalidSetting');
    $('#emailjsTemplateId').prev().removeClass('invalidSetting');
    $('#emailjsTemplateId').removeClass('invalidSetting');
    $('#njuskaloEmailForNewAdv').prev().removeClass('invalidSetting');
    $('#njuskaloEmailForNewAdv').removeClass('invalidSetting');
    //console.log(settings);
}
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
var allDescs = {};
var slimDescs = {};
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
              if (validateEmailJsSettings()) {
                  console.log('pokreni scanning');

                  sessionStorage.setItem('scanningActive', true);
                  location.reload();
              }
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

        if (validateEmailJsSettings()) {


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
        else {
            sessionStorage.removeItem('scanningActive');
        }

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
            var advertId = this.href.substring(this.href.lastIndexOf('-') + 1)
            var imgs = allImages[advertId];
            var desc = '<h2>Opis oglasa</h2><br>' + allDescs[advertId]
            var isSlimDesc = slimDescs[advertId];

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
                    
                    $('#jssor_1 .description').html(desc);

                    $('#jssor_1').removeClass('slimDesc');
                    $('#jssor_1').removeClass('fullDesc');

                    if (isSlimDesc)
                        $('#jssor_1').addClass('slimDesc');
                    else
                        $('#jssor_1').addClass('fullDesc');
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
    //var rows = $('.table-summary tbody tr');
    var dts = $('.BlockStandard.ClassifiedDetailBasicDetails .ClassifiedDetailBasicDetails-list dt');
    var dds = $('.BlockStandard.ClassifiedDetailBasicDetails .ClassifiedDetailBasicDetails-list dd');
    var mileage = 0;
    for (var j = 0; j < dts.length; j++) {
        var dt = dts[j];
        var dd = dds[j];

        if (dt.innerText.indexOf('Prijeđeni kilometri') >= 0) {
            mileage = parseInt(dd.innerText.trim().replace('km', ''));
            dd.innerHTML = dd.innerHTML.replace(mileage, formatFloat(mileage, 0));
        }
        else if (dt.innerText.indexOf('Snaga motora') >= 0) {
            var toHorsePower = dd.innerText.trim().replace('kW', '') * 1.3428;
            dd.innerHTML += '<span style="margin-left: 5px;">(' + Math.ceil(toHorsePower)  + ' HP)</span>';
            //concatTitle += ';' + dd.innerText.trim();
        }
    }
    //for (var j = 0; j < rows.length; j++) {
    //    if ($($(rows[j]).find('th'))[0].innerHTML == 'Prijeđeni kilometri:') {
    //        mileage = parseInt($($(rows[j]).find('td'))[0].innerHTML.replace('<abbr title="kilometri">km</abbr>', ''));
    //        $($(rows[j]).find('td'))[0].innerHTML = $($(rows[j]).find('td'))[0].innerHTML.replace(mileage, formatFloat(mileage, 0));
    //    }
    //    else if ($($(rows[j]).find('th'))[0].innerHTML == 'Snaga motora:') {
    //        var power = parseInt($($(rows[j]).find('td'))[0].innerHTML.replace('<abbr title="kilovati">kWh</abbr>', ''));
    //        $($(rows[j]).find('td'))[0].innerHTML = $($(rows[j]).find('td'))[0].innerHTML = power + ' <abbr title="kilovati">kWh</abbr> (' + Math.ceil(power * 1.3428) + ' hp)';
    //    }
    //}
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
        location.reload();
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

            if (sessionStorage.getItem('autoPaging') == "true" || sessionStorage.getItem('scanningActive') == "true") {
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
    var emailsSentForIds = sessionStorage.getItem("emailsSentForIds");
    if (emailsSentForIds == null)
        emailsSentForIds = [];
    else
        emailsSentForIds = JSON.parse(emailsSentForIds);

    if (emailsSentForIds.indexOf(newAdvert.advertId) < 0 && sessionStorage.getItem('scanningActive') != null && emailsSent > -1) {
        newAdvert.thumbnail = $('li[data-options="{\\"hasCompare\\":false,\\"id\\":' + newAdvert.advertId + '}"] .entity-thumbnail a>img').length == 0 ?
            $('li[data-options="{\\"hasCompare\\":true,\\"id\\":' + newAdvert.advertId + '}"] .entity-thumbnail a>img')[0].dataset.src.substring(2) : 
            $('li[data-options="{\\"hasCompare\\":false,\\"id\\":' + newAdvert.advertId + '}"] .entity-thumbnail a>img')[0].dataset.src.substring(2);

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
        //body += "<b>";
        body += "<b>" + formatFloat(newAdvert.priceHRK, 0) + " kn</b>";
        body += "<br>";
        body += "<b>" + formatFloat(newAdvert.priceEUR, 0) + " €</b>";
        //return;

        if (settings == null)
            settings = getSettings();

        $('#emailjsUserId').prev().removeClass('invalidSetting');
        $('#emailjsUserId').removeClass('invalidSetting');
        $('#emailjsTemplateId').prev().removeClass('invalidSetting');
        $('#emailjsTemplateId').removeClass('invalidSetting');
        $('#njuskaloEmailForNewAdv').prev().removeClass('invalidSetting');
        $('#njuskaloEmailForNewAdv').removeClass('invalidSetting');

        if (settings.email != null && settings.email.length > 0 &&
            settings.emailJsTemplateId != null && settings.emailJsTemplateId.length > 0 &&
            settings.emailJsUserId != null && settings.emailJsUserId.length > 0) {

            //sendWithSendGrid(subject, body, 'Njuskalo@sendgrid.com', settings.email);
            //sendWithMailgun(subject, body, emailSender, settings.email);
            //sendWithElastic(subject, body, 'postmaster@codius.co', settings.email)
            console.log('sending email...');
            sendWithEmailJS(subject, body, settings.email);
            emailsSent++;            

            emailsSentForIds.push(newAdvert.advertId);
            sessionStorage.setItem("emailsSentForIds", JSON.stringify(emailsSentForIds));
        }
        else {
            validateEmailJsSettings();

            //alert('Podaci za slanje email nedostaju');
            //$('body .content-primary #settingsModal').addClass('show');

            //if (settings.emailJsUserId == null || settings.emailJsUserId.length == 0) {
            //    $('#emailjsUserId').prev().addClass('invalidSetting');
            //    $('#emailjsUserId').addClass('invalidSetting');
            //}

            //if (settings.emailJsTemplateId == null || settings.emailJsTemplateId.length == 0) {
            //    $('#emailjsTemplateId').prev().addClass('invalidSetting');
            //    $('#emailjsTemplateId').addClass('invalidSetting');
            //}

            //if (settings.email == null || settings.email.length == 0) {
            //    $('#njuskaloEmailForNewAdv').prev().addClass('invalidSetting');
            //    $('#njuskaloEmailForNewAdv').addClass('invalidSetting');
            //}
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

    //var service_id = 'default_service';
    //var template_id = settings.emailJsTemplateId;
    //var template_params = {
    //    subject: subject,
    //    emailTo: to,
    //    message: body
    //};

    var data = {
        service_id: 'default_service',
        template_id: settings.emailJsTemplateId,
        user_id: settings.emailJsUserId,
        template_params: {
            subject: subject,
            emailTo: to,
            message: body
        }
    };

    try {
        $.ajax('https://api.emailjs.com/api/v1.0/email/send', {
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json'
        }).done(function () {
            console.log('Your mail is sent! - ' + subject);
        }).fail(function (error) {
            alert('Slanje maila nije prošlo: ' + error.responseText);
            console.log(error)
        });
        //emailjs.send(service_id, template_id, template_params);  
    }
    catch (ex) {
        alert('error sending email');
    }
}

function validateEmailJsSettings() {
    var validForm = true;

    if (settings.emailJsUserId == null || settings.emailJsUserId.length == 0) {
        $('#emailjsUserId').prev().addClass('invalidSetting');
        $('#emailjsUserId').addClass('invalidSetting');
        validForm = false;
    }

    if (settings.emailJsTemplateId == null || settings.emailJsTemplateId.length == 0) {
        $('#emailjsTemplateId').prev().addClass('invalidSetting');
        $('#emailjsTemplateId').addClass('invalidSetting');
        validForm = false;
    }

    if (settings.email == null || settings.email.length == 0) {
        $('#njuskaloEmailForNewAdv').prev().addClass('invalidSetting');
        $('#njuskaloEmailForNewAdv').addClass('invalidSetting');
        validForm = false;
    }

    if (validForm == false) {
        alert('Podaci za slanje email nedostaju');
        $('body .content-primary #settingsModal').addClass('show');
    }

    return validForm;
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
    var advertId = JSON.parse(this[0].attributes["data-options"].value).id;

    allImages[advertId] = images;

    var username = $(response).find('.Profile-wrapUsername a').attr('href');
    //return;
    var kilometri = "Prijeđeni kilometri: ";
    var motor = 'Motor: ';
    var rows = $(response).find('.table-summary tbody tr');
    var dts = $(response).find('.BlockStandard.ClassifiedDetailBasicDetails .ClassifiedDetailBasicDetails-list dt');
    var dds = $(response).find('.BlockStandard.ClassifiedDetailBasicDetails .ClassifiedDetailBasicDetails-list dd');
    var sideDescItems = [];
    var concatTitle = '';
    var lokacija = '';
    var kilometraža = '';
    var desc = '';

    try {
        desc = $(response).find('.ClassifiedDetailDescription-text').length > 0 ? $(response).find('.ClassifiedDetailDescription-text')[0].innerHTML.trim() : '';
        slimDescs[advertId] = !desc;
        if (!desc)
            desc = $(response).find('.BlockStandard.ClassifiedDetailHighlightedAttributes.cf')[0].innerHTML;
        allDescs[advertId] = desc;
    }
    catch(ex){ };

    if ($('.breadcrumb-items li:nth-child(4) a.link').html().indexOf('Osobni automobili') > -1) {
        

        //OSOBNI AUTOMOBILI
        for (var j = 0; j < dts.length; j++) {
            var dt = dts[j];
            var dd = dds[j];
            if (dt.innerText.indexOf('Marka automobila') >= 0) {
                concatTitle += dd.innerText.trim();
            }
            else if (dt.innerText.indexOf('Model automobila') >= 0) {
                concatTitle += ';' + dd.innerText.trim();
            }
            else if (dt.innerText.indexOf('Tip automobila') >= 0) {
                concatTitle += ';' + dd.innerText.trim();
            }
            else if (dt.innerText.indexOf('Godina proizvodnje') >= 0) {
                concatTitle += ';' + dd.innerText.replace('godište', '').trim();
            }
            else if (dt.innerText.indexOf('Motor') >= 0) {
                motor += dd.innerText.trim() + ' - ';
                concatTitle += ';' + dd.innerText.trim();
            }
            else if (dt.innerText.indexOf('Snaga motora') >= 0) {
                motor += dd.innerText.trim();
                var toHorsePower = dd.innerText.trim().replace('kW', '') * 1.3428;
                sideDescItems.push(motor + ' (' + Math.ceil(toHorsePower) + ' hp)');
                concatTitle += ';' + dd.innerText.trim();
            }
            else if (dt.innerText.indexOf('Mjenjač') >= 0) {
                sideDescItems.push('Mjenjač: ' + dd.innerText.trim());
            }
            else if (dt.innerText.indexOf('Vlasnik') >= 0) {
                sideDescItems.push('Vlasnik: ' + dd.innerText.trim());
            }
            else if (dt.innerText.indexOf('Lokacija vozila') >= 0) {
                lokacija = dd.innerText.trim();
            }
            else if (dt.innerText.indexOf('Prijeđeni kilometri') >= 0) {
                kilometraža = dd.innerText.trim();
            }
        }
    }
    else if ($('.breadcrumb-items li:nth-child(4) a.link').html().indexOf('Motocikli / Motori') > -1) {
        //MOTORI
        for (var j = 0; j < rows.length; j++) {
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
    }
    else if ($('.breadcrumb-items li:nth-child(3) a.link').html().indexOf('Nekretnine') > -1) {     

        for (var j = 0; j < dts.length; j++) {
            var dt = dts[j];
            var dd = dds[j];

            if (dt.innerText.indexOf('Grad/Općina') >= 0) {
                concatTitle += dd.innerText.trim();
            }
            else if (dt.innerText.indexOf('Naselje') >= 0) {
                concatTitle += ';' + dd.innerText.trim();
            }
            else if (dt.innerText.indexOf('Lokacija') >= 0) {
                concatTitle += ';' + dd.innerText.trim();
            }
            else if (dt.innerText.indexOf('Broj etaža') >= 0) {
                sideDescItems.push(dd.innerText.trim());
            }
            else if (dt.innerText.indexOf('Broj soba') >= 0) {
                sideDescItems.push(dd.innerText.trim());
                concatTitle += ';' + dd.innerText.trim();
            }
            else if (dt.innerText.indexOf('Kat') >= 0) {
                concatTitle += ';' + dd.innerText.trim() + '. kat';
            }
            else if (dt.innerText.indexOf('Šifra objekta') >= 0) {
                concatTitle += ';' + dd.innerText.trim();
            }
            else if (dt.innerText.indexOf('Stambena površina') >= 0) {
                concatTitle += ';' + dd.innerText.trim() + 'm2';
            }
            else if (dt.innerText.indexOf('Godina izgradnje') >= 0) {
                sideDescItems.push('Godina izgradnje: ' + dd.innerText.trim());
                concatTitle += '; izgrađeno '+ dd.innerText.trim();
            }
        }
        //for (var j = 0; j < rows.length; j++) {
        //    //if ($($(rows[j]).find('th'))[0].innerHTML == 'Županija:') {
        //    //	concatTitle += $($(rows[j]).find('td'))[0].innerHTML;
        //    //}
        //    if ($($(rows[j]).find('th'))[0].innerHTML == 'Grad/Općina:') {
        //        concatTitle += $($(rows[j]).find('td'))[0].innerHTML;
        //    }
        //    else if ($($(rows[j]).find('th'))[0].innerHTML == 'Naselje:') {
        //        concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
        //    }
        //    else if ($($(rows[j]).find('th'))[0].innerHTML == 'Lokacija:') {
        //        concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
        //    }
        //    //else if ($($(rows[j]).find('th'))[0].innerHTML == 'Tip stana:') {
        //    //    concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
        //    //}
        //    //else if ($($(rows[j]).find('th'))[0].innerHTML == 'Tip kuće:') {
        //    //    concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
        //    //}
        //    else if ($($(rows[j]).find('th'))[0].innerHTML == 'Broj etaža:') {
        //        sideDescItems.push('Broj etaža: ' + $($(rows[j]).find('td'))[0].innerText);
        //        //concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
        //    }
        //    else if ($($(rows[j]).find('th'))[0].innerHTML == 'Broj soba:') {
        //        sideDescItems.push('Broj soba: ' + $($(rows[j]).find('td'))[0].innerText);
        //        concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
        //    }
        //    else if ($($(rows[j]).find('th'))[0].innerHTML == 'Kat:') {
        //        concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML + '. kat';
        //    }
        //    else if ($($(rows[j]).find('th'))[0].innerHTML == 'Šifra objekta:') {
        //        concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML;
        //    }
        //    else if ($($(rows[j]).find('th'))[0].innerHTML == 'Stambena površina:') {
        //        concatTitle += ';' + $($(rows[j]).find('td'))[0].innerHTML + "m2";
        //    }
        //    else if ($($(rows[j]).find('th'))[0].innerHTML == 'Godina izgradnje:') {
        //        sideDescItems.push('Godina izgradnje: ' + $($(rows[j]).find('td'))[0].innerText);
        //        concatTitle += '; izgrađeno ' + $($(rows[j]).find('td'))[0].innerText;
        //    }
        //}
    }

    

    if (($(response).find('.Profile-wrapUsername>a.link')[0] && $(response).find('.Profile-wrapUsername>a.link')[0].innerHTML.trim() == 'Posjetite ovu Njuškalo trgovinu') ||
        ($(response).find('.ClassifiedDetailOwnerDetails-linkAllAds')[0] && $(response).find('.ClassifiedDetailOwnerDetails-linkAllAds')[0].innerHTML.trim() == 'Svi oglasi ove trgovine')) {
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

        if (lokacija.length > 0)
            concatTitle += ';' + lokacija;

        if (kilometraža.length > 0)
            concatTitle += ';' + kilometraža;
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
            if (summary.newPrices.indexOf(JSON.parse(jQueryElement.attr('data-options')).id) < 0) {
                summary.newPrices.push(JSON.parse(jQueryElement.attr('data-options')).id);
                //summary.newPrices2[JSON.parse(jQueryElement.attr('data-options')).id] = true;
                summary.newPrices2[JSON.parse(jQueryElement.attr('data-options')).id] = jQueryElement[0].innerText;
                //console.log("new price: " + JSON.parse(jQueryElement.attr('data-options')).id);
            }
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
    var largeImages = [];
    var thumbs = [];

    var index = $($(response).find('.BaseEntityThumbnails--multimedia.Gallery-thumbnails')).length - 1;
    if (index >= 0) {

        for (var i = 0; i < items.length; i++) {
            largeImages.push($(items[i])[0].href);
            if ($($(items[i])).find('img')[0]) {
                thumbs.push($($(items[i])).find('img')[0].src);
            }
            else {
                thumbs.push($(items[i])[0].href);
            }
        }
    }
    else {
        var items = $(response).find('.ClassifiedDetailGallery-sliderListItem--image img')
        for (var i = 0; i < items.length; i++) {
            var thumb = $(items[i]).attr('src');
            if (thumb == null)
                thumb = $(items[i]).attr('data-src');
            var largeImg = thumb.replace('image-80x60', 'image-w920x690');
            largeImages.push(largeImg);
            thumbs.push(thumb);
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
        var position =
            $('li[data-options="{\"hasCompare\":true,"isAdInSavedList":false,\"id\":' + array[i] + '}"]').length == 0 ?
                $('li[data-options="{\"hasCompare\":true,"isAdInSavedList":true,\"id\":' + array[i] + '}"]').length == 0 ?
                    $('li[data-options="{\"hasCompare\":false,"isAdInSavedList":false,\"id\":' + array[i] + '}"]').length == 0 ?
                        $('li[data-options="{\"hasCompare\":false,"isAdInSavedList":true,\"id\":' + array[i] + '}"]').offset().top
                    :
                    $('li[data-options="{\"hasCompare\":false,"isAdInSavedList":false,\"id\":' + array[i] + '}"]').offset().top
                :
                $('li[data-options="{\"hasCompare\":true,"isAdInSavedList":true,\"id\":' + array[i] + '}"]').offset().top
            :
            $('li[data-options="{\"hasCompare\":true,"isAdInSavedList":false,\"id\":' + array[i] + '}"]').offset().top;

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
    var priceHRK = 0;
    if ($(element).find('.price.price--hrk').length > 0) 
        priceHRK = $(element).find('.price.price--hrk')[0].innerText.replace('kn', '').trim();
    else
        priceHRK = $(element).find('.ClassifiedDetailSummary-priceDomestic').text().replace($(element).find('.ClassifiedDetailSummary-priceForeign').text(), '').replace('kn', '').trim();

    var priceEUR = 0;
    try {
        if ($(element).find('.ClassifiedDetailSummary-priceForeign').length > 0)
            priceEUR = $(element).find('.ClassifiedDetailSummary-priceForeign').text().replace('~', '').replace('€', '').trim()
        else
            priceEUR = $(element).find('.price.price--eur')[0].innerText.replace('€ ~', '').trim();
    }
    catch(ex){
        //price EUR 0 ako ne uspije parsiranje
    };

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
            if ($('.base-entity-meta').length > 0) {
                jQuery('<div/>', {
                    id: 'priceHistoryDiv',
                    class: 'price-history',
                }).appendTo($('.base-entity-meta'));
            }
            else {
                jQuery('<div/>', {
                    id: 'priceHistoryDiv',
                    class: 'price-history',
                }).appendTo($('.breadcrumbs.breadcrumbs--alpha'));
            }

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
    if ($('li[data-options="{\"hasCompare\":true,"isAdInSavedList":false,\"id\":' + this + '}"]').length > 0) {
        $('html, body').animate({
            scrollTop: $('li[data-options="{\"hasCompare\":true,"isAdInSavedList":false,\"id\":' + this + '}"]').offset().top
        }, 50);
    }
    else if ($('li[data-options="{\"hasCompare\":true,"isAdInSavedList":true,\"id\":' + this + '}"]').length > 0) {
        $('html, body').animate({
            scrollTop: $('li[data-options="{\"hasCompare\":true,"isAdInSavedList":true,\"id\":' + this + '}"]').offset().top
        }, 50);
    }
    else if ($('li[data-options="{\"hasCompare\":false,"isAdInSavedList":false,\"id\":' + this + '}"]').length > 0) {
        $('html, body').animate({
            scrollTop: $('li[data-options="{\"hasCompare\":false,"isAdInSavedList":false,\"id\":' + this + '}"]').offset().top
        }, 50);
    }
    else if ($('li[data-options="{\"hasCompare\":false,"isAdInSavedList":true,\"id\":' + this + '}"]').length > 0) {
        $('html, body').animate({
            scrollTop: $('li[data-options="{\"hasCompare\":false,"isAdInSavedList":true,\"id\":' + this + '}"]').offset().top
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