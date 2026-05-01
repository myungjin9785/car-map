const ADMIN_EMAIL = "myungjin4112@gmail.com";
const SUPABASE_URL = "https://zxqsegeraigsygpcxsoc.supabase.co";
const SUPABASE_KEY = "sb_publishable_wJ9tk64fPjSerrh5qweeUQ_FJf3v5J4";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let map;
let mapInitialized = false;
let markers = [];

let myLocationMarker = null;
let myLocationWatchId = null;
let blinkState = true;

// =========================
// 🔐 로그인
// =========================
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("이메일과 비밀번호를 입력하세요");
    return;
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  console.log("로그인 응답:", data, error);

  // 🔥 핵심: session 기준으로 판단
  if (error || !data || !data.session) {
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

  if (error || !user) {
    console.error("유저 가져오기 실패", error);
    return null;
  }

  return user;
}

// =========================
// 🔐 allowed_users 체크
// =========================
async function checkAllowedUser(user) {

  const { data, error } = await client
    .from("allowed_users")
    .select("email")
    .eq("email", user.email)
    .maybeSingle(); // 🔥 single 대신 안전하게

  if (error || !data) {
    alert("허용된 사용자만 사용 가능합니다.");

    await client.auth.signOut();
    location.reload();

    return false;
  }

  return true;
}

// =========================
// 📍 위치
// =========================
function updateMyLocation(lat, lng) {

  const position = new kakao.maps.LatLng(lat, lng);
  map.setCenter(position);

  if (myLocationMarker) {
    myLocationMarker.setMap(null);
  }

  const imageSrc = "https://cdn-icons-png.flaticon.com/512/64/64113.png";
  const imageSize = new kakao.maps.Size(30, 30);
  const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

  myLocationMarker = new kakao.maps.Marker({
    position,
    image: markerImage,
    zIndex: 9999
  });

  myLocationMarker.setMap(map);
}

// =========================
// 🔥 위치 추적
// =========================
function startTracking() {

  if (!navigator.geolocation) {
    alert("GPS 지원 안됨");
    return;
  }

  if (myLocationWatchId) {
    navigator.geolocation.clearWatch(myLocationWatchId);
  }

  myLocationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      updateMyLocation(pos.coords.latitude, pos.coords.longitude);
    },
    (err) => console.error("GPS 오류:", err),
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    }
  );
}

// =========================
// 📌 지도 초기화
// =========================
async function initMap() {

  const user = await getUser();
  if (!user) {
    alert("로그인 후 사용해주세요");
    return;
  }

  const allowed = await checkAllowedUser(user);
  if (!allowed) return;

  if (mapInitialized) return;

  const container = document.getElementById("map");

  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(35.8714, 128.6014),
    level: 3
  });

  mapInitialized = true;

  startTracking();
  loadMarkers();
}

// =========================
// 📌 저장
// =========================
async function saveData() {

  const user = await getUser();

  if (!user) {
    alert("로그인 후 사용해주세요");
    return;
  }

  const inspector = document.getElementById("inspector").value.trim();
  const carNumber = document.getElementById("carNumber").value.trim();
  const district = document.getElementById("district").value;
  const legal = document.getElementById("legal").value;
  const type = document.getElementById("type").value;

  if (!inspector || !carNumber || !district) {
    alert("필수 항목을 입력하세요");
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
      console.error(error);
      alert("저장 실패");
      return;
    }

    alert("저장 완료");
    addMarker(newData);

    document.getElementById("carNumber").value = "";
  });
}

// =========================
// 📌 마커 로드
// =========================
async function loadMarkers() {

  const { data, error } = await client.from("cars").select("*");

  if (error) {
    console.error(error);
    return;
  }

  markers.forEach(m => m.setMap(null));
  markers = [];

  data.forEach(addMarker);
}

// =========================
// 📌 마커 생성
// =========================
function addMarker(data) {

  if (!map) return;

  const imageSrc =
    data.legal === "불법"
      ? "/images/red.png"
      : "/images/blue.png";

  const imageSize = new kakao.maps.Size(24, 35);
  const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

  const position = new kakao.maps.LatLng(data.lat, data.lng);

  const marker = new kakao.maps.Marker({
    position,
    image: markerImage
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