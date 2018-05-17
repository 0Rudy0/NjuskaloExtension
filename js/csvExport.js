
function createCsvOfSqlData() {
    var db = openDatabase('Njuskalo', '1.0', 'Njuskalo pracenje cijena oglasa', 2 * 1024 * 1024);
    db.transaction(function (tx) {

        tx.executeSql('SELECT rowId, * FROM PriceHistory', [], function (tx, result) {
            console.log('price history count: ' + result.rows.length);
            var PriceHistory = [];
            PriceHistory.push(['Advert id', 'Price HRK', 'Price EUR', 'Date']);
            for (var i = 0; i < result.rows.length; i++) {
                var r = result.rows[i];
                PriceHistory.push([r.advertId, r.priceHRK, r.priceEUR, r.date]);
            }
            exportToCsv("PriceHistory" + customDateString() + '(_' + PriceHistory.length + ').csv', PriceHistory);
        }, function (tx, err) { log('error fetching PriceHistory'); logObj(err); })


        var e = new Date().getTime() + (1 * 1000);
        while (new Date().getTime() <= e) { }


        tx.executeSql('SELECT rowId, * FROM Advert', [], function (tx, result) {
            console.log('adverts count: ' + result.rows.length);
            var Adverts = [];
            Adverts.push(['Advert ID', 'Date last viewed', 'Date first viewed', 'Title', 'Main Description', 'username']);
            for (var i = 0; i < result.rows.length; i++) {
                var r = result.rows[i];
                while (r.title.indexOf(';') > -1 || r.title.indexOf(',') > -1) {
                    r.title = r.title.replace(';', '_');
                    r.title = r.title.replace(',', '.');
                }
                while (r.mainDesc.indexOf(';') > -1 || r.mainDesc.indexOf(',') > -1) {
                    r.mainDesc = r.mainDesc.replace(';', '_');
                    r.mainDesc = r.mainDesc.replace(',', '.');
                }
                Adverts.push([r.advertId, r.dateLastViewed, r.dateFirstViewed, r.title, r.mainDesc, r.username]);
            }
            exportToCsv("Adverts" + customDateString() + '_(' + Adverts.length + ').csv', Adverts);
            localStorage.setItem('lastBackupDateNjuskalo', (new Date()).getTime());
        }, function (tx, err) { log('error fetching Adverts'); logObj(err); });


        setTimeout(function () {
           
        }, 2000);
    });
}

function exportToCsv(filename, content) {
    var finalVal = '';

    for (var i = 0; i < content.length; i++) {
        var value = content[i];

        for (var j = 0; j < value.length; j++) {
            var innerValue = value[j] == null ? '' : value[j].toString();
            var result = innerValue.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0)
                result = '"' + result + '"';
            if (j > 0)
                finalVal += ';';
            finalVal += result;
        }

        finalVal += '\n';
    }

    //log(finalVal);

    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(finalVal));
    pom.setAttribute('download', filename);
    pom.click();
    //location.reload();
}

function stringifyAndExport(data) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent('var solarData = ' + JSON.stringify(data)));
    pom.setAttribute('download', 'jsonData_' + customDateString() + ';(' + data.length + ').js');
    pom.click();
}

function customDateString() {
    var date = new Date();
    var str = '[';
    str += date.getFullYear() + '.' + (date.getMonth() + 1).pad(2) + '.' + date.getDate().pad(2) + ']-' + date.getHours().pad(2) + '_' + date.getMinutes().pad(2);
    return str;
}

Number.prototype.pad = function (size) {
    var s = String(this);
    while (s.length < (size || 2)) { s = "0" + s; }
    return s;
}