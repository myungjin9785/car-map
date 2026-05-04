const ADMIN_EMAIL = "myungjin4112@gmail.com";
const SUPABASE_URL = "https://zxqsegeraigsygpcxsoc.supabase.co";
const SUPABASE_KEY = "sb_publishable_wJ9tk64fPjSerrh5qweeUQ_FJf3v5J4";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let map;
let mapInitialized = false;
let appStarted = false;
let markers = [];

let myLocationMarker = null;
let myLocationWatchId = null;
let radiusCircle = null;
let accuracyCircle = null;

let locationBuffer = [];
let firstFix = false;
let lastLoadLocation = null;

let selectedLat = null;
let selectedLng = null;
let selectedMarker = null;

let currentLat = null;
let currentLng = null;

// =========================
// 자동 로그아웃
// =========================
const AUTO_LOGOUT_MS = 10 * 60 * 1000;
const LOGIN_TIME_KEY = "carCheckLoginTime";
let autoLogoutTimer = null;

function clearAutoLogoutTimer() {
  if (!autoLogoutTimer) return;
  clearTimeout(autoLogoutTimer);
  autoLogoutTimer = null;
}

async function forceAutoLogout() {
  clearAutoLogoutTimer();
  localStorage.removeItem(LOGIN_TIME_KEY);
  await client.auth.signOut();
  location.reload();
}

function startAutoLogoutTimer() {
  clearAutoLogoutTimer();

  let loginTime = Number(localStorage.getItem(LOGIN_TIME_KEY));

  if (!loginTime) {
    loginTime = Date.now();
    localStorage.setItem(LOGIN_TIME_KEY, String(loginTime));
  }

  const remaining = AUTO_LOGOUT_MS - (Date.now() - loginTime);

  if (remaining <= 0) {
    forceAutoLogout();
    return;
  }

  autoLogoutTimer = setTimeout(forceAutoLogout, remaining);
}

// =========================
// 모바일 체크
// =========================
function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// =========================
// 로그인
// =========================
async function login() {
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("이메일과 비밀번호를 입력하세요");
    return;
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data?.session) {
    alert("로그인 실패");
    return;
  }

  const { data: allowedUser, error: allowedError } = await client
    .from("allowed_users")
    .select("email")
    .ilike("email", data.user.email)
    .maybeSingle();

  if (allowedError) {
    console.error(allowedError);
    alert("사용자 확인 중 오류가 발생했습니다");
    return;
  }

  if (!allowedUser) {
    await client.auth.signOut();
    alert("허용되지 않은 사용자입니다");
    return;
  }

  localStorage.setItem(LOGIN_TIME_KEY, String(Date.now()));
  startApp();
}

// =========================
// 유저
// =========================
async function getUser() {
  const { data: { user } } = await client.auth.getUser();
  return user;
}

// =========================
// 시작
// =========================
function startApp() {
  if (appStarted) return;
  appStarted = true;

  startAutoLogoutTimer();

  document.getElementById("loginScreen").style.display = "none";

  const intro = document.getElementById("intro");
  intro.style.display = "flex";

  setTimeout(() => {
    intro.style.opacity = "0";

    setTimeout(() => {
      intro.remove();
      document.getElementById("topBar").style.display = "block";

      kakao.maps.load(initMap);
    }, 1200);
  }, 800);
}

// =========================
// 자동 로그인
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await client.auth.getSession();
  if (session) startApp();
});

// =========================
// 거리 계산
// =========================
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// =========================
// 위치 안정화
// =========================
function getStableLocation(lat, lng) {
  locationBuffer.push({ lat, lng });
  if (locationBuffer.length > 5) locationBuffer.shift();

  return {
    lat: locationBuffer.reduce((sum, p) => sum + Number(p.lat), 0) / locationBuffer.length,
    lng: locationBuffer.reduce((sum, p) => sum + Number(p.lng), 0) / locationBuffer.length
  };
}

// =========================
// 반경 원
// =========================
function drawRadiusCircle(lat, lng) {
  if (radiusCircle) radiusCircle.setMap(null);

  radiusCircle = new kakao.maps.Circle({
    center: new kakao.maps.LatLng(lat, lng),
    radius: 500,
    strokeWeight: 2,
    strokeColor: "#007BFF",
    fillColor: "#007BFF",
    fillOpacity: 0.15
  });

  radiusCircle.setMap(map);
}

// =========================
// 정확도 원
// =========================
function drawAccuracyCircle(lat, lng, accuracy) {
  if (accuracyCircle) accuracyCircle.setMap(null);

  accuracyCircle = new kakao.maps.Circle({
    center: new kakao.maps.LatLng(lat, lng),
    radius: accuracy,
    strokeWeight: 1,
    strokeColor: "#00C853",
    fillColor: "#00C853",
    fillOpacity: 0.1
  });

  accuracyCircle.setMap(map);
}

// =========================
// 내 위치
// =========================
function updateMyLocation(lat, lng, accuracy) {
  currentLat = lat;
  currentLng = lng;

  const pos = new kakao.maps.LatLng(lat, lng);
  map.setCenter(pos);

  if (!myLocationMarker) {
    myLocationMarker = new kakao.maps.CustomOverlay({
      position: pos,
      content: '<div class="my-location-dot"></div>',
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 20
    });

    myLocationMarker.setMap(map);
  } else {
    myLocationMarker.setPosition(pos);
  }

  drawRadiusCircle(lat, lng);
  drawAccuracyCircle(lat, lng, accuracy);
}

// =========================
// 마커 로드
// =========================
async function loadMarkersNearby(lat, lng, force = false) {
  if (!force && lastLoadLocation) {
    const dist = getDistance(lat, lng, lastLoadLocation.lat, lastLoadLocation.lng);
    if (dist < 30) return;
  }

  lastLoadLocation = { lat, lng };

  const { data, error } = await client
    .from("cars")
    .select("*");

  if (error) {
    console.error("DB error:", error);
    return;
  }

  markers.forEach(marker => marker.setMap(null));
  markers = [];

  if (!data) return;

  data
    .filter(item => item.lat && item.lng)
    .map(item => ({
      ...item,
      lat: Number(item.lat),
      lng: Number(item.lng)
    }))
    .filter(item => getDistance(lat, lng, item.lat, item.lng) <= 500)
    .forEach(addMarker);
}

// =========================
// 위치 추적
// =========================
function startTracking() {
  if (!navigator.geolocation) {
    alert("이 브라우저에서는 위치 기능을 사용할 수 없습니다");
    return;
  }

  myLocationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const accuracy = pos.coords.accuracy;

      if (!firstFix) firstFix = true;
      else if (accuracy > 120) return;

      const stable = getStableLocation(
        pos.coords.latitude,
        pos.coords.longitude
      );

      updateMyLocation(stable.lat, stable.lng, accuracy);
      loadMarkersNearby(stable.lat, stable.lng);
    },
    (err) => {
      console.error("GPS 실패:", err);
      alert("현재 위치를 가져오지 못했습니다");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );
}

// =========================
// 지도 초기화
// =========================
async function initMap() {
  const user = await getUser();
  if (!user || mapInitialized) return;

  map = new kakao.maps.Map(document.getElementById("map"), {
    center: new kakao.maps.LatLng(35.8714, 128.6014),
    level: 3
  });

  mapInitialized = true;

  loadMarkersNearby(35.8714, 128.6014, true);
  startTracking();

  if (!isMobile()) {
    kakao.maps.event.addListener(map, "click", function(mouseEvent) {
      selectedLat = mouseEvent.latLng.getLat();
      selectedLng = mouseEvent.latLng.getLng();

      if (selectedMarker) selectedMarker.setMap(null);

      selectedMarker = new kakao.maps.Marker({
        position: mouseEvent.latLng
      });

      selectedMarker.setMap(map);
    });
  }
}

// =========================
// 저장
// =========================
async function saveData() {
  const inspector = document.getElementById("inspector").value.trim();
  const carNumber = document.getElementById("carNumber").value.trim();
  const district = document.getElementById("district").value;

  if (!inspector || !carNumber || !district) {
    alert("조사자명, 차량번호, 행정구역은 필수입니다");
    return;
  }

  if (!isMobile() && selectedLat !== null && selectedLng !== null) {
    await insertData(selectedLat, selectedLng);
    resetClick();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      await insertData(pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      console.error(err);
      alert("위치를 가져오지 못했습니다");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );
}

// =========================
// DB 저장
// =========================
async function insertData(lat, lng) {
  try {
    const user = await getUser();

    if (!user) {
      alert("로그인이 필요합니다");
      return;
    }

    const newData = {
      inspector: document.getElementById("inspector").value.trim(),
      car_number: document.getElementById("carNumber").value.trim(),
      district: document.getElementById("district").value,
      legal: document.getElementById("legal").value,
      type: document.getElementById("type").value,
      lat: Number(lat),
      lng: Number(lng)
    };

    const { data, error } = await client
      .from("cars")
      .insert([newData])
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("저장 실패: " + error.message);
      return;
    }

    alert("저장 완료");

    const savedData = {
      ...(data || newData),
      lat: Number((data || newData).lat),
      lng: Number((data || newData).lng)
    };

    const centerLat = currentLat ?? savedData.lat;
    const centerLng = currentLng ?? savedData.lng;

    if (getDistance(centerLat, centerLng, savedData.lat, savedData.lng) <= 500) {
      addMarker(savedData);
    }

    await loadMarkersNearby(centerLat, centerLng, true);
  } catch (err) {
    console.error(err);
    alert("오류: " + err.message);
  }
}

// =========================
// 클릭 위치 초기화
// =========================
function resetClick() {
  selectedLat = null;
  selectedLng = null;

  if (selectedMarker) {
    selectedMarker.setMap(null);
    selectedMarker = null;
  }
}

// =========================
// 마커
// =========================
function addMarker(data) {
  const legal = String(data.legal || "").trim();

  const imageSrc =
    legal === "불법"
      ? "images/redpoint.png"
      : "images/bluepoint.png";

  const markerImage = new kakao.maps.MarkerImage(
    imageSrc,
    new kakao.maps.Size(12, 18),
    {
      offset: new kakao.maps.Point(6, 18)
    }
  );

  const marker = new kakao.maps.Marker({
    position: new kakao.maps.LatLng(Number(data.lat), Number(data.lng)),
    image: markerImage
  });

  marker.setMap(map);
  markers.push(marker);
}

// =========================
// 로그아웃
// =========================
async function logout() {
  clearAutoLogoutTimer();
  localStorage.removeItem(LOGIN_TIME_KEY);

  await client.auth.signOut();

  if (myLocationWatchId) {
    navigator.geolocation.clearWatch(myLocationWatchId);
  }

  location.reload();
}
