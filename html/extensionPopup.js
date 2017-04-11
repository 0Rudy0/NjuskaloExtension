var actionOnDuplicate = 'stop';


actionOnDuplicate = localStorage.getItem('savedAction') ? localStorage.getItem('savedAction') : actionOnDuplicate;
document.getElementById('startAutoPaging').addEventListener('click', startAutoPaging);

var btns = document.getElementsByClassName('btn-3')
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


function startAutoPaging() {
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

function setActionOnDuplicate(e) {
	actionOnDuplicate = e.currentTarget.getAttribute('data-action');
	var btns = document.getElementsByClassName('btn-3');
	for (var i = 0; i < btns.length; i++) {
		btns[i].className = btns[i].className.replace('active', '');
	}
	e.currentTarget.className += ' active';
	localStorage.setItem('savedAction', actionOnDuplicate);
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

const docStyle = document.documentElement.style
const aElem = document.querySelector('a')
const boundingClientRect = aElem.getBoundingClientRect()


