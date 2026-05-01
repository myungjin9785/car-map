const ADMIN_EMAIL = "myungjin4112@gmail.com";
const SUPABASE_URL = "https://zxqsegeraigsygpcxsoc.supabase.co";
const SUPABASE_KEY = "sb_publishable_wJ9tk64fPjSerrh5qweeUQ_FJf3v5J4";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let map;
let mapInitialized = false;
let markers = [];

let myLocationMarker = null;
let myLocationWatchId = null;
let blinkInterval = null;
let isBlinkVisible = true;

// =========================
// 🔐 유저 가져오기
// =========================
async function getUser() {
  const { data: { user }, error } = await client.auth.getUser();

  if (error) {
    console.error("유저 가져오기 실패", error);
    return null;
  }

  return user;
}

// =========================
// 📍 내 위치 마커 생성
// =========================
function createMyMarker(lat, lng) {
  const position = new kakao.maps.LatLng(lat, lng);

  // 기존 마커 제거
  if (myLocationMarker) {
    myLocationMarker.setMap(null);
  }

  const imageSrc = "https://cdn-icons-png.flaticon.com/512/64/64113.png";
  const imageSize = new kakao.maps.Size(28, 28);
  const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

  myLocationMarker = new kakao.maps.Marker({
    position,
    image: markerImage,
    zIndex: 9999
  });

  myLocationMarker.setMap(map);

  map.setCenter(position);
}

// =========================
// 🔥 실시간 위치 추적 시작
// =========================
function startTrackingMyLocation() {

  if (!navigator.geolocation) {
    alert("GPS 지원 안됨");
    return;
  }

  // 기존 감시 제거 (중복 방지)
  if (myLocationWatchId) {
    navigator.geolocation.clearWatch(myLocationWatchId);
  }

  myLocationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      createMyMarker(lat, lng);

    },
    (err) => {
      console.error("위치 추적 실패:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    }
  );

  // 🔥 깜빡임 (1번만 실행)
  if (!blinkInterval) {
    blinkInterval = setInterval(() => {

      if (!myLocationMarker) return;

      const markerElement = myLocationMarker.getContent?.();

      // 카카오 마커는 DOM 직접 접근이 제한적이라 opacity 대신 toggle 방식
      if (myLocationMarker.getVisible) {
        isBlinkVisible = !isBlinkVisible;
        myLocationMarker.setVisible(isBlinkVisible);
      }

    }, 600);
  }
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

  if (mapInitialized) return;

  const container = document.getElementById("map");

  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(35.8714, 128.6014),
    level: 3
  });

  mapInitialized = true;

  // 🔥 내 위치 추적 시작
  startTrackingMyLocation();

  // 🔥 기존 데이터 로드
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

  navigator.geolocation.getCurrentPosition(
    async (pos) => {

      const newData = {
        inspector,
        car_number: carNumber,
        district,
        legal,
        type,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      const { error } = await client
        .from("cars")
        .insert([newData]);

      if (error) {
        console.error("저장 실패:", error);
        alert("저장 실패");
        return;
      }

      alert("저장 완료");

      addMarker(newData);

      document.getElementById("carNumber").value = "";
    },
    (err) => {
      console.error("GPS 오류:", err);
      alert("GPS 오류 또는 권한 문제");
    }
  );
}

// =========================
// 📌 전체 마커 로드
// =========================
async function loadMarkers() {

  const { data, error } = await client
    .from("cars")
    .select("*");

  if (error) {
    console.error("조회 실패:", error);
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

  kakao.maps.event.addListener(marker, () => {
    alert(
      `조사자: ${data.inspector}
차량번호: ${data.car_number}
행정구역: ${data.district}
차종: ${data.type}
상태: ${data.legal}`
    );
  });
}

// =========================
// 🔓 로그아웃
// =========================
async function logout() {

  const { error } = await client.auth.signOut();

  if (error) {
    console.error("로그아웃 실패:", error);
    alert("로그아웃 실패");
    return;
  }

  // 🔥 위치 추적 정리
  if (myLocationWatchId) {
    navigator.geolocation.clearWatch(myLocationWatchId);
  }

  if (blinkInterval) {
    clearInterval(blinkInterval);
  }

  location.reload();
}