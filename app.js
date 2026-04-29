const SUPABASE_URL = "https://zxqsegeraigsygpcxsoc.supabase.co";
const SUPABASE_KEY = "sb_publishable_wJ9tk64fPjSerrh5qweeUQ_FJf3v5J4";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let map;

// =========================
// 📌 폼 열기
// =========================
function addForm() {
  document.getElementById("formArea").style.display = "block";
}

// =========================
// 📌 GPS 개선 버전 저장
// =========================
function saveData() {
  const carNumber = document.getElementById("carNumber").value;
  const legal = document.getElementById("legal").value;
  const type = document.getElementById("type").value;

  if (!carNumber) {
    alert("차량번호를 입력하세요");
    return;
  }

  // 🔥 GPS 개선 버전
  if (!navigator.geolocation) {
    alert("GPS를 지원하지 않는 브라우저입니다");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      console.log("GPS 위치:", lat, lng);

      const { error } = await client
        .from("cars")
        .insert([
          {
            car_number: carNumber,
            legal,
            type,
            lat,
            lng
          }
        ]);

      if (error) {
        alert("저장 실패");
        console.error(error);
      } else {
        alert("저장 완료");
        loadMarkers();
      }
    },
    (err) => {
      console.error(err);

      if (err.code === 1) {
        alert("위치 권한을 허용해주세요");
      } else if (err.code === 2) {
        alert("위치 정보를 가져올 수 없습니다");
      } else if (err.code === 3) {
        alert("GPS 요청 시간이 초과되었습니다");
      } else {
        alert("GPS 오류 발생");
      }
    },
    {
      enableHighAccuracy: true, // 🔥 정확도 최대
      timeout: 10000,           // 10초 제한
      maximumAge: 0             // 캐시 사용 안함
    }
  );
}

// =========================
// 📌 지도 초기화
// =========================
window.onload = function () {
  if (typeof kakao === "undefined") {
    alert("카카오 SDK 로딩 실패");
    return;
  }

  const container = document.getElementById('map');

  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(35.8714, 128.6014),
    level: 3
  });

  loadMarkers();
};

// =========================
// 📌 Supabase → 마커 표시
// =========================
async function loadMarkers() {
  const { data, error } = await client.from("cars").select("*");

  if (error) {
    console.error(error);
    return;
  }

  data.forEach((item) => {
    addMarker(item);
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

  const imageSize = new kakao.maps.Size(24, 35);
  const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

  const position = new kakao.maps.LatLng(data.lat, data.lng);

  const marker = new kakao.maps.Marker({
    position: position,
    image: markerImage
  });

  marker.setMap(map);

  kakao.maps.event.addListener(marker, function () {
    alert(
      "차량번호: " + data.car_number +
      "\n차종: " + data.type +
      "\n상태: " + data.legal
    );
  });
}