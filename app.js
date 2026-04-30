const ADMIN_EMAIL = "myungjin4112@gmail.com";
const SUPABASE_URL = "https://zxqsegeraigsygpcxsoc.supabase.co";
const SUPABASE_KEY = "sb_publishable_wJ9tk64fPjSerrh5qweeUQ_FJf3v5J4";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let map;
let mapInitialized = false;
let markers = [];

// =========================
// 🔐 로그인 유저 가져오기
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


  // 🔥 모든 로그인 유저 지도 데이터 조회
  loadMarkers();
  }

// =========================
// 📌 저장 (로그인만 하면 가능)
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

  // 🔥 유효성 검사
  if (!inspector) {
    alert("조사자명을 입력하세요");
    return;
  }

  if (!carNumber) {
    alert("차량번호를 입력하세요");
    return;
  }

  if (!district) {
    alert("행정구역을 선택하세요");
    return;
  }

  if (!navigator.geolocation) {
    alert("GPS를 지원하지 않는 브라우저입니다");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const newData = {
        inspector,
        car_number: carNumber,
        district,
        legal,
        type,
        lat,
        lng
      };

      const { error } = await client
        .from("cars")
        .insert([newData]);

      if (error) {
        alert("저장 실패");
        console.error(error);
        return;
      }

      alert("저장 완료");

      // 🔥 관리자면 바로 지도 반영
      if (user.email === ADMIN_EMAIL) {
        addMarker(newData);
      }

      // 🔥 입력값 초기화 (UX 개선)
      document.getElementById("carNumber").value = "";

    },
    (err) => {
      if (err.code === 1) alert("위치 권한을 허용해주세요");
      else if (err.code === 2) alert("위치 정보를 가져올 수 없습니다");
      else if (err.code === 3) alert("GPS 요청 시간이 초과되었습니다");
      else alert("GPS 오류 발생");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// =========================
// 📌 관리자용 전체 조회
// =========================
async function loadMarkers() {

  const { data, error } = await client.from("cars").select("*");

  if (error) {
    console.error("조회 실패", error);
    return;
  }

  // 기존 마커 제거
  markers.forEach(m => m.setMap(null));
  markers = [];

  data.forEach((item) => {
    addMarker(item);
  });
}

// =========================
// 📌 마커 생성
// =========================
function addMarker(data) {

  if (!map) return; // 🔥 안전장치

  const imageSrc =
    data.legal === "불법"
      ? "/images/red.png"
      : "/images/blue.png";

  const imageSize = new kakao.maps.Size(24, 35);
  const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

  const position = new kakao.maps.LatLng(data.lat, data.lng);

  const marker = new kakao.maps.Marker({
    position: position,
    image: markerImage
  });

  marker.setMap(map);
  markers.push(marker);

  kakao.maps.event.addListener(marker, function () {
    alert(
      "조사자: " + data.inspector +
      "\n차량번호: " + data.car_number +
      "\n행정구역: " + data.district +
      "\n차종: " + data.type +
      "\n상태: " + data.legal
    );
  });
}

// 🔓 로그아웃
// =========================
async function logout() {
  const { error } = await client.auth.signOut();

  if (error) {
    alert("로그아웃 실패");
    console.error(error);
    return;
  }

  location.reload(); // 로그인 화면으로 복귀
}