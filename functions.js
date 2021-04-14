const baseurl = "https://wap.tplinkcloud.com";
var proxyurl = "https://cors.smartathome.co.uk/";
var autoRefreshTimer;
var user_info = {};

$( document ).ready(function() {
	testFirstCookie();
	document.getElementById("password").onkeydown = function (e) {
		if (e.keyCode === 13) {
			do_login();
		}
	};
	user_info = {
		"kasa_token": getCookie("kasa_token"),
	};
	console.log(user_info);
	logged_in = check_login();
	console.log("logged_in");
	console.log(logged_in);
	if (logged_in["success"] === true) {
		user_info["devices"] = logged_in["devices"];
		on_login();
		user_info["logged_in"] = true;
	} else {
		on_logout();
		user_info["logged_in"] = false;
	}

	readLocalStorage();
	$('#autorefresh').on("change", function () {
		localStorage.autoRefresh = $(this).prop("checked");
		checkAutorefresh();
	});
	checkAutorefresh();
});

function login(username, password, storecreds) {
	console.log("login");
	var url = baseurl;
	var data = {
		"method": "login",
		"params": {
			"cloudUserName": username,
			"cloudPassword": password,
			"appType": "Kasa_Android",
			"terminalUUID": uuidv4(),
		}
	}
	$.ajax({
		url: proxyurl+url,
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify(data),
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			user_info["email"] = username;
			user_info["password"] = password;
			store_tokens(json, storecreds);
		}
	});
}

function store_tokens(json, storecreds) {
	console.log("store_tokens");
	if ("result" in json && "token" in json["result"]) {
		user_info["kasa_token"] = json["result"]["token"];
		user_info["logged_in"] = true;
		if (storecreds === true) {
			setCookie("kasa_token", json["result"]["token"], 24*365);
		}
	}
}

function get_device_list() {
	console.log("get_device_list");
	to_return = {};
	var url = baseurl+"?token="+user_info["kasa_token"];
	data = {
		"method": "getDeviceList"
	}
	$.ajax({
		url: proxyurl+url,
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify(data),
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			if ("result" in json && "deviceList" in json["result"]) {
				to_return["devices"] = json["result"]["deviceList"];
				to_return["success"] = true;
				localStorage.devices = JSON.stringify(to_return["devices"]);
			}
		}
	});
	for (device of to_return["devices"]) {
		device["info"] = get_device_info(device);
	}
	return to_return;
}

function get_device_info(device) {
	console.log("get_device_info");
	var info = {};
	var appServerUrl = device["appServerUrl"];
	var url = appServerUrl+"?token="+user_info["kasa_token"];
	var device_id = device["deviceId"];
	data = {
		"method": "passthrough",
		"params": {
			"deviceId": device_id,
			"requestData": {
				"system": {
					"get_sysinfo": null
				}
			}
		}
	}
	$.ajax({
		url: proxyurl+url,
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify(data),
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			if ("result" in json && "responseData" in json["result"]
					&& "system" in json["result"]["responseData"]
					&& "get_sysinfo" in json["result"]["responseData"]["system"]) {
				info = json["result"]["responseData"]["system"]["get_sysinfo"];
			}
		}
	});
	return info;
}

function adjust_device(device, action, new_state) {
	console.log("adjust_device");
	to_return = {};
	var url = baseurl+"?token="+user_info["kasa_token"];
	var device_id = device["deviceId"];
	var data = {
		"method": "passthrough",
		"params": {
			"deviceId": device_id,
			"requestData": {
				"smartlife.iot.smartbulb.lightingservice": {
					"transition_light_state": {
						"ignore_default": 1
					}
				}
			}
		}
	}

	data["params"]["requestData"]["smartlife.iot.smartbulb.lightingservice"]["transition_light_state"][action] = new_state;

	$.ajax({
		url: proxyurl+url,
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify(data),
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			to_return = json;
		}
	});
	return to_return
}

function do_login() {
	console.log("do_login");
	var login_div = document.getElementById("login");
	login_div.classList.add("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.remove("hidden");
	var username = document.getElementById("username").value;
	var password = document.getElementById("password").value;
	var storecreds = document.getElementById("storecreds").checked;
	setTimeout(function(){
		login(username, password, storecreds);
		if (user_info["logged_in"] === true) {
			device_list = get_device_list(false);
			user_info["devices"] = device_list["devices"]
			on_login();
		} else {
			on_logout();
			document.getElementById("loginfailed").innerHTML = "Login failed";
		}
	}, 100);
}

function check_login() {
	console.log("check_login");
	if (user_info["kasa_token"] !== "") {
		device_list = get_device_list(false);
		console.log("device_list");
		console.log(device_list);
		return device_list;
	} else {
		console.log("No kasa_token");
		return {"success": false};
	}
}

function readLocalStorage(){
	// Not initialized
	if (localStorage.autoRefresh == null) {
		localStorage.autoRefresh = "true";
		localStorage.theme = "a";
	}
	$('#autorefresh').prop( "checked", localStorage.autoRefresh === "true").checkboxradio( "refresh" );
	if (localStorage.theme !== "a") {
		checkTheme();
	}
}

function checkTheme(){
	switchTheme();
	localStorage.theme = $("#page").attr("data-theme");
}

function checkAutorefresh(){
	clearInterval(autoRefreshTimer);
	if (localStorage.autoRefresh === "true" && user_info["logged_in"] === true) {
		autoRefreshTimer = setInterval(update_devices, 31_000);
	}
}

function on_login() {
	console.log("on_login");
	var login_div = document.getElementById("login");
	login_div.classList.add("hidden");
	var switches = document.getElementById("switches");
	switches.classList.remove("hidden");
	var buttons = document.getElementById("buttons");
	buttons.classList.remove("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.add("hidden");
	update_devices();
	checkAutorefresh();
}

function update_devices() {
	console.log("update_devices");
	var devices = user_info["devices"];
	for (device_no in devices) {
		add_or_update_switch(devices[device_no], device_no);
	}
}

function toggle(device_no) {
	console.log("toggle");
	var device = user_info["devices"][device_no];
	state = device["info"]["light_state"]["on_off"];
	var dev_type = device["deviceType"];
	if (state == false || dev_type === "scene") {
		new_state = 1;
	} else {
		new_state = 0;
	}
	success = adjust_device(device, "on_off", new_state);
	if ("error_code" in success && success["error_code"] == 0){
		device["info"]["light_state"]["on_off"] = new_state;
		add_or_update_switch(device, device_no);
	}
}

function change_brightness(device_no, new_brightness) {
	console.log("change_brightness: "+new_brightness);
	var this_type = "smartlife.iot.smartbulb.lightingservice"
	var device = user_info["devices"][device_no];
	success = adjust_device(device, "brightness", new_brightness);
	if ("result" in success && "responseData" in success["result"] &&
			this_type in success["result"]["responseData"] &&
			"transition_light_state" in success["result"]["responseData"][this_type] &&
			"brightness" in success["result"]["responseData"][this_type]["transition_light_state"]) {
		device["info"]["light_state"]["brightness"] = success["result"]["responseData"][this_type]["transition_light_state"]["brightness"];
		add_or_update_switch(device, device_no);
	}
}

function change_color_temperature(device_no, new_temperature) {
	console.log("change_color_temp");
	var device = user_info["devices"][device_no];
	success = adjust_device(device, "color_temp", new_temperature);
	if ("header" in success && "code" in success["header"] && success["header"]["code"] === "SUCCESS"){
		device["info"]["light_state"]["color_temp"] = new_temperature;
	}
}

function on_logout() {
	console.log("on_logout");
	var switches = document.getElementById("switches");
	switches.classList.add("hidden");
	var login_div = document.getElementById("login");
	login_div.classList.remove("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.add("hidden");
}

function add_or_update_switch(device, device_no){
	console.log("add_or_update_switch");
	console.log(device);
	var name = device["alias"];
	var device_id = device["deviceId"];
	var type = device["deviceType"];
	var state = 0;
	if ("light_state" in device["info"]) {
		state = device["info"]["light_state"]["on_off"];
	}
	var online = device["status"];
	if (online == false) { state = false };
	var icon = device["icon"];
	var currentActionDiv = $('#action_'+ device_id);
	if(currentActionDiv.length === 0) {
		var deviceDiv = createElement("div", "gridElem singleSwitch borderShadow ui-btn ui-btn-up-b ui-btn-hover-b " + getSwitchClass(type, state));
		var nameDiv = createElement("div", "switchName");
		nameDiv.innerHTML = name;
		var imgTable = createElement("table", "switchImg");
		var imgTd = createElement("td");
		imgTd.innerHTML = createImg(icon, name, type);
		imgTable.appendChild(imgTd);
		if (device["info"]["is_color"] == 1 && online == true) {
			var cTd = createColorSelector(device, device_no);
			imgTable.appendChild(cTd);
		}
		var actionDiv = createElement("div", "switchAction");
		actionDiv.setAttribute("id", "action_" + device_id);
		actionDiv.innerHTML = createActionLink(device_no, online, state, type);
		deviceDiv.appendChild(imgTable);
		deviceDiv.appendChild(nameDiv);
		deviceDiv.appendChild(actionDiv);
		if (device["info"]["is_dimmable"] && online == true) {
			var bTable = createBrightnessSlider(device, device_no);
			deviceDiv.appendChild(bTable);
		}
		if (device["info"]["is_variable_color_temp"] && online == true) {
			var ctTable = createColorTempSlider(device, device_no);
			deviceDiv.appendChild(ctTable);
		}
		document.getElementById("switches").appendChild(deviceDiv);
	} else {
		var parentDiv = currentActionDiv.parent()[0];
		parentDiv.classList.remove("switch_true");
		parentDiv.classList.remove("switch_false");
		parentDiv.classList.add(getSwitchClass(type, state));
		currentActionDiv.remove();
		var newActionDiv = createElement("div", "switchAction");
		newActionDiv.setAttribute("id", "action_" + device_id);
		newActionDiv.innerHTML = createActionLink(device_no, online, state, type);
		parentDiv.appendChild(newActionDiv);
		if (device["info"]["is_dimmable"] && online == true) {
			document.getElementById("brightness_" + device_id).value = device["info"]["light_state"]["brightness"];
		}
		if (device["info"]["is_variable_color_temp"] && online == true) {
			document.getElementById("colortemp_" + device_id).value = device["info"]["light_state"]["color_temp"];
		}
	}
	setUpColors();
}

function getSwitchClass(type, state){
	return "switch_" + (type === "scene" ? "scene" : state);
}

function createColorSelector(device, device_no){
	var cTd = createElement("td", "colorSelectorTd");
	var inp = document.createElement("input", "colorSelector");
	h = device["info"]["light_state"]["hue"];
	s = device["info"]["light_state"]["saturation"];
	v = device["info"]["light_state"]["brightness"];
	inp.value = "hsv("+h+", "+s+", "+v+")";
	inp.id = "color_"+device_no;
	cTd.appendChild(inp);
	return cTd;
}

function createBrightnessSlider(device, device_no){
	var device_id = device["deviceId"];
	var bTable = createElement("table", "switchBrightness");
	var bTd = createElement("td");
	var brightnessDiv = createElement("input", "slider100");
	brightnessDiv.id = "brightness_" + device_id;
	brightnessDiv.type = "range";
	brightnessDiv.min = 0;
	brightnessDiv.max = 100;
	brightnessDiv.value = device["info"]["light_state"]["brightness"];
	brightnessDiv.onchange = function () { change_brightness(device_no, this.value) };
	bTd.appendChild(brightnessDiv);
	bTable.appendChild(bTd);
	var bTd2 = createElement("td");
	bTd2.innerHTML = "&#128262;";
	bTable.appendChild(bTd2);
	return bTable;
}

function createColorTempSlider(device, device_no){
	var device_id = device["deviceId"];
	var ctTable = createElement("table", "switchColorTemp");
	var ctTd1 = createElement("td");
	ctTd1.innerHTML = "<small>2700K</small>";
	ctTable.appendChild(ctTd1);
	var ctTd = createElement("td");
	var colorTempDiv = createElement("input", "colorTempSlider");
	colorTempDiv.id = "colortemp_" + device_id;
	colorTempDiv.type = "range";
	colorTempDiv.min = 2500;
	colorTempDiv.max = 9000;
	colorTempDiv.value = device["info"]["light_state"]["color_temp"];
	colorTempDiv.onchange = function () { change_color_temperature(device_no, this.value) };
	ctTd.appendChild(colorTempDiv);
	ctTable.appendChild(ctTd);
	var ctTd2 = createElement("td");
	ctTd2.innerHTML = "<small>6500K</small>";
	ctTable.appendChild(ctTd2);
	return ctTable;
}

function createActionLink(device, online, state, type){
	var onString = type === "scene" ? "Start" : "On";
	if (online == false) {
		return '<a href="#" class="borderShadow ui-btn ui-disabled ui-btn-inline ui-icon-power ui-btn-icon-left">Offline</a>';
	} else if (state == false) {
		return '<a href="#" class="borderShadow ui-btn ui-btn-b ui-btn-inline ui-icon-power ui-btn-icon-left" onclick="toggle('+device+');">Off</a>';
	} else {
		return '<a href="#" class="borderShadow ui-btn ui-btn-inline ui-icon-power ui-btn-icon-left" onclick="toggle('+device+');">' + onString + '</a>';
	}
}

function createImg(icon, name, type){
	if (isNullOrEmpty(icon)) {
		return "<p>" + type + "</p>";
	}
	return "<img width=50 src='" + icon + "' alt='" + name + "'>";
}

function createElement(typeName, className){
	var elem = document.createElement(typeName);
	if (!isNullOrEmpty(className)) {
		elem.className = className;
	}
	return elem;
}

function isNullOrEmpty(entry){
	return entry == null || entry === '';
}

function logout() {
	setCookie("access_token", "", -1);
	setCookie("sl_refresh_token", "", -1);
	setCookie("sl_expires_in", "", -1);
	location.reload();
}

function setUpColors() {
	$("[id^=color_]").spectrum({
		type: "color",
		hideAfterPaletteSelect: true,
		showInitial: true,
		showAlpha: false,
		allowEmpty: false,
		change: function() {
			changeColor(this)
		}
	});
	$(".color_disabled").spectrum("disable");
}

function changeColor(element) {
	device_no = element.id.replace("color_", "");
	var device = user_info["devices"][device_no];
	var t = $("#"+element.id).spectrum("get");
	hsv = t.toHsv();
	h = hsv["h"];
	s = hsv["s"];
	v = hsv["v"];
	var new_color = {"hue": h, "saturation": s, "brightness": device["data"]["brightness"]};
	success = adjust_device(device, "colorSet", "color", new_color);
	if ("header" in success && "code" in success["header"] && success["header"]["code"] === "SUCCESS"){
		device["data"]["hue"] = h;
		device["data"]["saturation"] = s;
		localStorage.devices = JSON.stringify(user_info["devices"]);
	}
}

function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}