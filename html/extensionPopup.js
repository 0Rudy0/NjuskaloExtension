function startAutoPaging() {
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		chrome.tabs.sendMessage(tabs[0].id, '');
	});
}

//alert('hello');

document.getElementById('startAutoPaging').addEventListener('click', startAutoPaging);