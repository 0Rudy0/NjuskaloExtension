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


function startAutoPaging() {
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		chrome.tabs.sendMessage(tabs[0].id, actionOnDuplicate);
		window.close();
	});
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

//alert('hello');
