const ADMIN_EMAIL = "myungjin4112@gmail.com";
const SUPABASE_URL = "https://zxqsegeraigsygpcxsoc.supabase.co";
const SUPABASE_KEY = "sb_publishable_wJ9tk64fPjSerrh5qweeUQ_FJf3v5J4";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let map;
let mapInitialized = false;
let markers = [];

let myLocationMarker = null;
let myLocationWatchId = null;
let radiusCircle = null;
let accuracyCircle = null;

let locationBuffer = [];
let firstFix = false;
let lastLoadLocation = null;

// 🔥 데스크탑 클릭 좌표
let selectedLat = null;
let selectedLng = null;
let selectedMarker = null;

// =========================
// 🔐 로그인
// =========================
async function login() {
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("이메일과 비밀번호를 입력하세요");
    return;
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data || !data.session) {
    alert("이메일과 비밀번호를 다시 확인해 주세요");
    return;
  }

  const user = data.user;

  const { data: allowedUser } = await client
    .from("allowed_users")
    .select("email")
    .ilike("email", user.email)
    .maybeSingle();

  if (!allowedUser) {
    await client.auth.signOut();
    alert("허용되지 않은 사용자");
    return;
  }

  startApp();
}

// =========================
// 🔐 유저 가져오기
// =========================
async function getUser() {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}

// =========================
// 🚀 앱 시작
// =========================
function startApp() {
  document.getElementById("loginScreen").style.display = "none";

  const intro = document.getElementById("intro");
  intro.style.display = "flex";

  setTimeout(() => {
    intro.style.opacity = "0";

    setTimeout(() => {
      intro.remove();
      document.getElementById("topBar").style.display = "block";

      kakao.maps.load(() => {
        initMap();
      });

    }, 1500);
  }, 1000);
}

// =========================
// 🔄 자동 로그인
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await client.auth.getSession();
  if (session) startApp();
});

// =========================
// 📍 거리 계산
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
// 🔥 위치 안정화
// =========================
function getStableLocation(lat, lng) {
  locationBuffer.push({ lat, lng });

  if (locationBuffer.length > 5) {
    locationBuffer.shift();
  }

  return {
    lat: locationBuffer.reduce((s, p) => s + p.lat, 0) / locationBuffer.length,
    lng: locationBuffer.reduce((s, p) => s + p.lng, 0) / locationBuffer.length
  };
}

// =========================
// 🔵 500m 원
// =========================
function drawRadiusCircle(lat, lng) {
  if (radiusCircle) radiusCircle.setMap(null);

  radiusCircle = new kakao.maps.Circle({
    center: new kakao.maps.LatLng(lat, lng),
    radius: 500,
    strokeWeight: 2,
    strokeColor: '#007BFF',
    fillColor: '#007BFF',
    fillOpacity: 0.15
  });

  radiusCircle.setMap(map);
}

// =========================
// 🟢 정확도 원
// =========================
function drawAccuracyCircle(lat, lng, accuracy) {
  if (accuracyCircle) accuracyCircle.setMap(null);

  accuracyCircle = new kakao.maps.Circle({
    center: new kakao.maps.LatLng(lat, lng),
    radius: accuracy,
    strokeWeight: 1,
    strokeColor: '#00C853',
    fillColor: '#00C853',
    fillOpacity: 0.1
  });

  accuracyCircle.setMap(map);
}

// =========================
// 📍 위치 표시
// =========================
function updateMyLocation(lat, lng, accuracy) {
  const pos = new kakao.maps.LatLng(lat, lng);
  map.setCenter(pos);

  if (myLocationMarker) myLocationMarker.setMap(null);

  myLocationMarker = new kakao.maps.Marker({ position: pos });
  myLocationMarker.setMap(map);

  drawRadiusCircle(lat, lng);
  drawAccuracyCircle(lat, lng, accuracy);
}

// =========================
// 🔥 주변 데이터
// =========================
async function loadMarkersNearby(lat, lng) {

  if (lastLoadLocation) {
    const dist = getDistance(lat, lng, lastLoadLocation.lat, lastLoadLocation.lng);
    if (dist < 20) return;
  }

  lastLoadLocation = { lat, lng };

  const { data, error } = await client
    .from("cars")
    .select("*")
    .gte("lat", lat - 0.005)
    .lte("lat", lat + 0.005)
    .gte("lng", lng - 0.005)
    .lte("lng", lng + 0.005);

  if (error) return;

  markers.forEach(m => m.setMap(null));
  markers = [];

  data
    .filter(d => getDistance(lat, lng, d.lat, d.lng) <= 500)
    .forEach(addMarker);
}

// =========================
// 🔥 위치 추적
// =========================
function startTracking() {

  myLocationWatchId = navigator.geolocation.watchPosition(
    (pos) => {

      const accuracy = pos.coords.accuracy;

      if (!firstFix) {
        firstFix = true;
      } else {
        if (accuracy > 100) return; // 🔥 정확도 개선
      }

      const stable = getStableLocation(
        pos.coords.latitude,
        pos.coords.longitude
      );

      updateMyLocation(stable.lat, stable.lng, accuracy);
      loadMarkersNearby(stable.lat, stable.lng);

    },
    () => console.log("GPS 사용 불가 (데스크탑 가능성)"),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );
}

// =========================
// 📌 지도 초기화
// =========================
async function initMap() {

  const user = await getUser();
  if (!user) return;

  if (mapInitialized) return;

  map = new kakao.maps.Map(document.getElementById("map"), {
    center: new kakao.maps.LatLng(35.8714, 128.6014),
    level: 3
  });

  mapInitialized = true;
  startTracking();

  // 🔥 데스크탑 클릭 저장 + 시각화
  kakao.maps.event.addListener(map, 'click', function(mouseEvent) {

    selectedLat = mouseEvent.latLng.getLat();
    selectedLng = mouseEvent.latLng.getLng();

    if (selectedMarker) selectedMarker.setMap(null);

    selectedMarker = new kakao.maps.Marker({
      position: mouseEvent.latLng
    });

    selectedMarker.setMap(map);

    alert("클릭 위치 저장됨");
  });
}

// =========================
// 📌 저장 (🔥 핵심)
// =========================
async function saveData() {

  const user = await getUser();
  if (!user) return;

  const inspector = document.getElementById("inspector").value.trim();
  const carNumber = document.getElementById("carNumber").value.trim();
  const district = document.getElementById("district").value;
  const legal = document.getElementById("legal").value;
  const type = document.getElementById("type").value;

  if (!inspector || !carNumber || !district) {
    alert("필수 항목 입력");
    return;
  }

  // 🔥 1순위: 클릭 좌표
  if (selectedLat && selectedLng) {
    insertData(selectedLat, selectedLng);
    return;
  }

  // 🔥 2순위: GPS
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      insertData(pos.coords.latitude, pos.coords.longitude);
    },
    () => {
      alert("위치 못 가져옴 → 지도 클릭 사용");
    }
  );
}

// =========================
// 📌 DB 저장
// =========================
async function insertData(lat, lng) {

  const newData = {
    inspector: document.getElementById("inspector").value.trim(),
    car_number: document.getElementById("carNumber").value.trim(),
    district: document.getElementById("district").value,
    legal: document.getElementById("legal").value,
    type: document.getElementById("type").value,
    lat,
    lng
  };

  const { error } = await client.from("cars").insert([newData]);

  if (error) {
    alert("저장 실패: " + error.message);
    return;
  }

  alert("저장 완료");

  loadMarkersNearby(lat, lng);
}

// =========================
// 📌 마커
// =========================
function addMarker(data) {

  const imageSrc =
    data.legal === "불법"
      ? "/images/red.png"
      : "/images/blue.png";

  const marker = new kakao.maps.Marker({
    position: new kakao.maps.LatLng(data.lat, data.lng),
    image: new kakao.maps.MarkerImage(imageSrc, new kakao.maps.Size(24, 35))
  });

  marker.setMap(map);
  markers.push(marker);
}

// =========================
// 🔓 로그아웃
// =========================
async function logout() {
  await client.auth.signOut();

  if (myLocationWatchId) {
    navigator.geolocation.clearWatch(myLocationWatchId);
  }

  location.reload();
}