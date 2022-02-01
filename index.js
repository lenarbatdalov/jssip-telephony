const provider_settings = {
  "server":       "wss://webrtc.uiscom.ru:",
  "domain":       "voip.uiscom.ru",
  "rlogin":       "",
  "rkey":         "",
  "login":        "",
  "password":     "",
  "sip_login":    "",
  "sip_password": ""
};

function login() {
  window.socket = new JsSIP.WebSocketInterface(provider_settings?.server);

  window.ua = new JsSIP.UA({
    uri: "sip:" + provider_settings.sip_login + "@" + provider_settings.domain,
    password: provider_settings.sip_password,
    display_name: "telephony_uiscom",
    sockets: [window.socket],
    session_timers: false
  });

  // соединяемся с астером
  window.ua.on('connecting', () => {
    console.log("UA connecting");
  });

  // соединились с астером
  window.ua.on('connected', () => {
    console.log("UA connected");
  });

  // астер нас зарегал, теперь можно звонить и принимать звонки
  window.ua.on('registered', () => {
    console.log("UA registered");
  });

  // астер про нас больше не знает
  window.ua.on('unregistered', () => {
    console.log("UA unregistered");
  });

  // астер не зарегал нас, что то не то, скорее всего неверный логин или пароль
  window.ua.on('registrationFailed', (data) => {
    console.error("UA registrationFailed", data.cause);
  });

  // заводим шарманку
  // JsSIP.debug.enable('JsSIP:*');
  window.ua.start();
}

function call(_phone_numbers = []) {
  if (_phone_numbers.length >= 10 && _phone_numbers[0] == '+' && _phone_numbers[1] == '7') {
    _phone_numbers = '8' + _phone_numbers.slice(2);
  }

  // если есть объект jssip для исходящих звонков (он при логине создаётся)
  if (window.ua) {
    // Вызываем метод call и если записываем полученную сессию исходящего звонка
    window.session = window.ua.call(_phone_numbers, options);

    // Астер нас соединил с абонентом
    window.session.on('connecting', function() {
      playSound("ringback.ogg", true);

      // Тут мы подключаемся к микрофону и цепляем к нему поток, который пойдёт в астер
      let peerconnection = window.session.connection;
      window.localStream = peerconnection.getLocalStreams()[0];
      if (window.localStream) {
        let localStream = window.localStream;
        window.localClonedStream = localStream.clone();
        let localAudioControl = document.getElementById("localAudio");
        localAudioControl.srcObject = window.localClonedStream;
      }

      // Как только астер отдаст нам поток абонента, мы его засунем к себе в наушники
      peerconnection.addEventListener('addstream', (event) => {
        let remoteAudioControl = document.getElementById("remoteAudio");
        remoteAudioControl.srcObject = event.stream;
        remoteAudioControl.play();
      });
    });

    // В процессе дозвона
    window.session.on('progress', function() {
      console.log("UA session progress");
    });

    // Дозвон завершился неудачно, например, абонент сбросил звонок
    window.session.on('failed', function(data) {
      console.log("UA session failed");
      console.log("Я или Абонент сбросил");
    });

    // Поговорили, разбежались
    window.session.on('ended', function(data) {
      console.log("UA session ended");
      console.log("Я или Абонент завершил разговор");
    });

    // Звонок принят, моно начинать говорить
    window.session.on('accepted', function() {
      console.log("UA session accepted");
      console.log("Поднял трубку");
    });
  }
}

/** входящий звонок */
function incomingCall() {
  // событие создания сессии входящих звонков
  window.ua.on('newRTCSession', function(data) {
    // записываем в хранилище сессию
    window.iSession = data.session;

    // если направление звонка - входящий
    if (window.iSession.direction !== "incoming") {
      return;
    }

    // вызываем функцию обработчика с пустым типом (для инициализации)
    console.log("incoming");

    // При возникновении/инициации входящего звонка (когда кто-то тебе позвонил)
    stopSound();
    playSound('ringing.ogg', true);

    // крутим вертим всё по стримам звука, получаем стрим и кидаем его в элемент аудио на странице
    window.iSession.on('peerconnection', function(data) {
      data.peerconnection.addEventListener('addstream', function (e) {
        // set remote audio stream
        let remoteAudioControl = document.getElementById("remoteAudio");
        remoteAudioControl.srcObject = e.stream;
        remoteAudioControl.play();
      });
    });

    // Звонок принят, можно начинать говорить
    window.iSession.on('accepted', function() {
      console.log("UA session accepted");
      stopSound();
      playSound('answered.mp3', false);
    });

    window.iSession.on("confirmed", function(data) {
      console.log('call confirmed');
    });

    window.iSession.on("ended", function(data) {
      console.log('call ended');
      stopSound();
      playSound('rejected.mp3', false);
    });

    window.iSession.on("failed", function(data) {
      console.log("session failed");
      stopSound();
    });
  });
}

function answer() {
  window.iSession.answer(options);
}

function reject() {
  if (window.iSession != null) {
    window.iSession.terminate();
    window.iSession = null;
  } else {
    window.session.terminate();
  }

  stopSound();
  playSound('rejected.mp3', false);
}

/** играть звук */
function playSound(soundName, loop) {
  let sound_element = document.getElementById('sounds');
  sound_element.src = `./sounds/${soundName}`;
  sound_element.loop = loop;
  sound_element.muted = true;
  sound_element.play();
  sound_element.muted = false;
}

/** остановить звук */
function stopSound() {
  let sound_element = document.getElementById('sounds');
  sound_element.pause();
  sound_element.currentTime = 0.0;
}

const options = {
  "pcConfig": {
    "hackStripTcp": true,
    "iceServers": [
      {
        "urls": [
          "stun:stun.l.google.com:19302"
        ]
      }
    ],
    "iceTransportPolicy": "all"
  },
  "mediaConstraints": {
    "audio": true,
    "video": false
  },
  "rtcOfferConstraints": {
    "offerToReceiveAudio": 1,
    "offerToReceiveVideo": 0
  }
}

if (provider_settings.login.length > 0) {
  login();
  incomingCall();
}
