var actionOnDuplicate = 'stop';
var refreshPattern = 5; //in minutes


actionOnDuplicate = localStorage.getItem('savedAction') ? localStorage.getItem('savedAction') : actionOnDuplicate;


document.getElementById('startAutoPaging').addEventListener('click', startAutoPagingFunction);
document.getElementById('toggleAutoScanning').addEventListener('click', toggleAutoScanningFunction);

(function () {
    //if (sessionStorage.getItem('scanningActive') != null) {
    //    document.getElementById('toggleAutoScanning').innerHTML = 'Zaustavi SCANNING';
    //    document.getElementById('toggleAutoScanning').value = 'Zaustavi SCANNING';
    //}
    //else {
    //    document.getElementById('toggleAutoScanning').innerHTML = 'Pokreni SCANNING';
    //    document.getElementById('toggleAutoScanning').value = 'Pokreni SCANNING';
    //}
});

var btns = document.getElementsByClassName('btn-3');

for (var i = 0; i < btns.length; i++) {
	btns[i].addEventListener('click', setActionOnDuplicate);
	if (btns[i].getAttribute('data-action') == actionOnDuplicate) {
		btns[i].className += ' active';
	}
}

if (localStorage.getItem('currentAction')) {
	document.getElementById('startAutoPaging').setAttribute('data-action', localStorage.getItem('currentAction'));
	//document.getElementById('startAutoPaging').innerHTML = localStorage.getItem('currentActionName');
	document.getElementById('startAutoPaging').value = localStorage.getItem('currentActionName');
}


function startAutoPagingFunction() {
	if (document.getElementById('startAutoPaging').getAttribute('data-action') == 'start') {
		document.getElementById('startAutoPaging').innerHTML = 'Zaustavi AUTO-PAGING';
		document.getElementById('startAutoPaging').value = 'Zaustavi AUTO-PAGING';
		document.getElementById('startAutoPaging').setAttribute('data-action', 'stop');
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, { action: 'start', onDuplicate: actionOnDuplicate });
			//window.close();
		});
		localStorage.setItem('currentAction', 'stop');
		localStorage.setItem('currentActionName', 'Zaustavi AUTO-PAGING');
	}
	else {
		document.getElementById('startAutoPaging').innerHTML = 'Pokreni AUTO-PAGING';
		document.getElementById('startAutoPaging').value = 'Pokreni AUTO-PAGING';
		document.getElementById('startAutoPaging').setAttribute('data-action', 'start');
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, { action: 'stop' });
			//window.close();
		});
		localStorage.setItem('currentAction', 'start');
		localStorage.setItem('currentActionName', 'Pokreni AUTO-PAGING');
	}
}

function toggleAutoScanningFunction() {
    //if (sessionStorage.getItem('scanningActive') != null) {
    //    sessionStorage.removeItem('scanningActive');
    //    document.getElementById('toggleAutoScanning').innerHTML = 'Pokreni SCANNING';
    //    document.getElementById('toggleAutoScanning').value = 'Pokreni SCANNING';
    //}
    //else {
    //    sessionStorage.setItem('scanningActive', true);
    //    document.getElementById('toggleAutoScanning').innerHTML = 'Zaustavi SCANNING';
    //    document.getElementById('toggleAutoScanning').value = 'Zaustavi SCANNING';
    //}

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleScanning'});
        //window.close();
    });
}



chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
  	console.log(request);
  	document.getElementById('startAutoPaging').innerHTML = 'Pokreni AUTO-PAGING';
  	document.getElementById('startAutoPaging').value = 'Pokreni AUTO-PAGING';
  	document.getElementById('startAutoPaging').setAttribute('data-action', 'start');  
  	localStorage.setItem('currentAction', 'start');
  	localStorage.setItem('currentActionName', 'Pokreni AUTO-PAGING');
  });

//alert('hello');

//const docStyle = document.documentElement.style
//const aElem = document.querySelector('a')
//const boundingClientRect = aElem.getBoundingClientRect()


