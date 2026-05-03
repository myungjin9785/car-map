const ADMIN_EMAIL = "myungjin4112@gmail.com";
const SUPABASE_URL = "https://zxqsegeraigsygpcxsoc.supabase.co";
const SUPABASE_KEY = "sb_publishable_wJ9tk64fPjSerrh5qweeUQ_FJf3v5J4";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let map;
let mapInitialized = false;
let markers = [];

let myLocationMarker = null;
let myLocationWatchId = null;
let radiusCircle = null; // 🔥 원 추가

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

  const { data: allowedUser, error: allowError } = await client
    .from("allowed_users")
    .select("email")
    .ilike("email", user.email)
    .maybeSingle();

  if (allowError || !allowedUser) {
    await client.auth.signOut();
    alert("이메일과 비밀번호를 다시 확인해 주세요");
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
// 🔵 500m 원 그리기
// =========================
function drawRadiusCircle(lat, lng) {

  const center = new kakao.maps.LatLng(lat, lng);

  if (radiusCircle) {
    radiusCircle.setMap(null);
  }

  radiusCircle = new kakao.maps.Circle({
    center: center,
    radius: 500,
    strokeWeight: 2,
    strokeColor: '#007BFF',
    strokeOpacity: 0.8,
    fillColor: '#007BFF',
    fillOpacity: 0.2
  });

  radiusCircle.setMap(map);
}

// =========================
// 📍 위치 표시
// =========================
function updateMyLocation(lat, lng) {

  const position = new kakao.maps.LatLng(lat, lng);
  map.setCenter(position);

  if (myLocationMarker) myLocationMarker.setMap(null);

  myLocationMarker = new kakao.maps.Marker({
    position,
    zIndex: 9999
  });

  myLocationMarker.setMap(map);

  drawRadiusCircle(lat, lng); // 🔥 핵심
}

// =========================
// 🔥 주변 데이터 로드
// =========================
async function loadMarkersNearby(lat, lng) {

  const range = 0.005;
  const radius = 500;

  const { data, error } = await client
    .from("cars")
    .select("*")
    .gte("lat", lat - range)
    .lte("lat", lat + range)
    .gte("lng", lng - range)
    .lte("lng", lng + range);

  if (error) {
    console.error(error);
    return;
  }

  markers.forEach(m => m.setMap(null));
  markers = [];

  const filtered = data.filter(item =>
    getDistance(lat, lng, item.lat, item.lng) <= radius
  );

  filtered.forEach(addMarker);
}

// =========================
// 🔥 위치 추적
// =========================
function startTracking() {

  myLocationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      updateMyLocation(lat, lng);
      loadMarkersNearby(lat, lng);
    },
    (err) => console.error(err),
    { enableHighAccuracy: true }
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
}

// =========================
// 📌 저장
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

  navigator.geolocation.getCurrentPosition(async (pos) => {

    const newData = {
      inspector,
      car_number: carNumber,
      district,
      legal,
      type,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };

    const { error } = await client.from("cars").insert([newData]);

    if (error) {
      alert("저장 실패");
      return;
    }

    alert("저장 완료");

    loadMarkersNearby(pos.coords.latitude, pos.coords.longitude);
  });
}

// =========================
// 📌 마커 생성
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