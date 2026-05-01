const ADMIN_EMAIL = "myungjin4112@gmail.com";
const SUPABASE_URL = "https://zxqsegeraigsygpcxsoc.supabase.co";
const SUPABASE_KEY = "sb_publishable_wJ9tk64fPjSerrh5qweeUQ_FJf3v5J4";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let map;
let mapInitialized = false;
let markers = [];

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
// 📌 지도 초기화
// =========================
async function initMap() {

  const user = await getUser();

  if (!user) {
    alert("로그인 후 사용해주세요");
    return;
  }

  if (mapInitialized) return;

  if (typeof kakao === "undefined" || !kakao.maps) {
    console.log("카카오 SDK 아직 안됨");
    return;
  }

  const container = document.getElementById('map');

  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(35.8714, 128.6014),
    level: 3
  });

  mapInitialized = true;

  // 🔥 전체 유저 지도 조회
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

  if (!navigator.geolocation) {
    alert("GPS를 지원하지 않는 브라우저입니다");
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
        console.error(error);
        alert("저장 실패");
        return;
      }

      alert("저장 완료");

      // 🔥 즉시 반영 (전체 유저)
      addMarker(newData);

      // 입력 초기화
      document.getElementById("carNumber").value = "";

    },
    (err) => {
      console.error(err);
      alert("GPS 오류 또는 권한 문제");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
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
    console.error("조회 실패", error);
    return;
  }

  // 기존 마커 제거
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

  const marker = new kakao.maps.Marker({
    position: new kakao.maps.LatLng(data.lat, data.lng),
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
    console.error(error);
    alert("로그아웃 실패");
    return;
  }

  location.reload();
}