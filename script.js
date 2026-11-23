// TRENDORA DEMO STORE
// 상품 정보는 Supabase의 shop_products 표에서 불러옵니다.
const HERO_IMAGES = [
  "img/hero-01.jpg",
  "img/hero-02.jpg",
  "img/hero-03.jpg",
  "img/hero-04.jpg"
];

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const won = n => `${Number(n).toLocaleString("ko-KR")}원`;
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

let session = null;
let userProfile = null;
let cart = load("trendora_cart", []); // 장바구니에는 상품 id와 수량만 저장
let activeCategory = "전체";
let slideIndex = 0;
let slideTimer;
let selectedProduct = null;
let productCache = new Map();
let productRequestNumber = 0;

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function displayGrade(grade) {
  return grade === "WELCOME" ? "BRONZE" : grade;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function renderAccountMenu() {
  const menu = $("#account-menu");
  if (!menu) return;
  menu.innerHTML = session
    ? `<button class="icon-btn" id="profile-btn">${escapeHtml(userProfile?.name || session.user.email)} 님</button><span aria-hidden="true">·</span><button class="icon-btn" id="account-logout-btn">로그아웃</button>`
    : `<button class="icon-btn" id="account-btn">로그인 · 회원가입</button>`;
}

async function loadProfile() {
  if (!session) {
    userProfile = null;
    renderAccountMenu();
    return null;
  }

  const { data, error } = await db
    .from("shop_profiles")
    .select("id,email,name,phone,grade,points,role,created_at")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error(error.message);
    toast("회원 정보를 불러오지 못했습니다.");
    userProfile = null;
    renderAccountMenu();
    return null;
  }

  userProfile = data;
  renderAccountMenu();
  return userProfile;
}

async function syncSession() {
  const { data, error } = await db.auth.getSession();
  if (error) {
    console.error(error.message);
    toast("로그인 상태를 확인하지 못했습니다.");
    return;
  }
  session = data.session;
  await loadProfile();
}

function productImage(url) {
  return url && String(url).trim() ? String(url) : HERO_IMAGES[0];
}

function rememberProducts(products) {
  products.forEach(product => productCache.set(String(product.id), product));
}

// 현재 분류와 검색어에 맞는 활성 상품을 Supabase에서 조회
async function loadProducts() {
  const requestNumber = ++productRequestNumber;
  const grid = $("#product-grid");
  grid.innerHTML = `<div class="no-results">불러오는 중</div>`;

  const keyword = $("#product-search").value.trim();
  let query = db
    .from("shop_products")
    .select("id,name,category,price,stock,image_url,is_active,created_at")
    .eq("is_active", true);

  if (activeCategory !== "전체") {
    query = query.eq("category", activeCategory);
  }
  if (keyword) {
    query = query.ilike("name", `%${keyword}%`);
  }

  const { data, error } = await query.order("id", { ascending: true });

  // 빠르게 연속 검색했을 때 이전 응답이 최신 결과를 덮지 않도록 함
  if (requestNumber !== productRequestNumber) return;

  if (error) {
    console.error(error.message);
    grid.innerHTML = `<div class="no-results">상품을 불러오지 못했습니다.</div>`;
    return;
  }

  const products = data || [];
  rememberProducts(products);
  renderProducts(products);
}

function renderProducts(products) {
  const grid = $("#product-grid");
  if (!products.length) {
    grid.innerHTML = `<div class="no-results">상품이 없습니다</div>`;
  } else {
    grid.innerHTML = products.map(product => {
      const soldOut = Number(product.stock) <= 0;
      return `
        <article class="product-card" data-product="${escapeHtml(product.id)}">
          <div class="product-photo">
            <img src="${escapeHtml(productImage(product.image_url))}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='${HERO_IMAGES[0]}'">
            ${soldOut ? `<span class="product-tag">품절</span>` : ""}
            <button class="quick-add" data-quick="${escapeHtml(product.id)}" ${soldOut ? "disabled" : ""}>${soldOut ? "품절" : "QUICK ADD +"}</button>
          </div>
          <div class="product-info">
            <h3>${escapeHtml(product.name)}</h3>
            <div class="product-meta"><span>${won(product.price)}</span><span>♡</span></div>
            <div class="product-category">${escapeHtml(product.category)}</div>
          </div>
        </article>`;
    }).join("");
  }

  $$(".filter").forEach(button => {
    button.classList.toggle("active", button.dataset.category === activeCategory);
  });
}

function setCategory(category) {
  activeCategory = category;
  $("#product-search").value = "";
  loadProducts();
  $("#products").scrollIntoView({ behavior: "smooth" });
}

// 상세 화면은 상품 id로 Supabase에서 한 건만 조회
async function openProduct(id) {
  const detail = $("#product-detail");
  detail.innerHTML = `<div class="no-results">불러오는 중</div>`;
  openPanel("product-modal");

  const { data, error } = await db
    .from("shop_products")
    .select("id,name,category,price,stock,image_url,is_active,created_at")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    if (error) console.error(error.message);
    detail.innerHTML = `<div class="no-results">상품을 불러오지 못했습니다.</div>`;
    return;
  }

  selectedProduct = data;
  productCache.set(String(data.id), data);
  const soldOut = Number(data.stock) <= 0;

  detail.innerHTML = `
    <div class="detail-layout">
      <img src="${escapeHtml(productImage(data.image_url))}" alt="${escapeHtml(data.name)}" onerror="this.onerror=null;this.src='${HERO_IMAGES[0]}'">
      <div class="detail-copy">
        <p class="eyebrow">TRENDORA SELECT</p>
        <h2>${escapeHtml(data.name)}</h2>
        <p class="detail-price">${won(data.price)}</p>
        <p class="detail-desc">매일의 스타일에 자연스럽게 어울리는 TRENDORA의 데일리 아이템입니다.<br>여유로운 실루엣과 편안한 착용감을 경험해 보세요.</p>
        <p class="product-category">카테고리 · ${escapeHtml(data.category)}　/　재고 ${Number(data.stock)}개</p>
        ${soldOut ? `<p class="product-category">품절</p>` : `<select id="detail-qty" aria-label="수량 선택">${Array.from({ length: Math.min(5, Number(data.stock)) }, (_, i) => `<option value="${i + 1}">${i + 1}개</option>`).join("")}</select>`}
        <button class="primary-btn" id="detail-add" ${soldOut ? "disabled" : ""}>${soldOut ? "품절" : "장바구니 담기"} <span>→</span></button>
      </div>
    </div>`;
}

function addToCart(id, qty = 1) {
  const product = productCache.get(String(id));
  if (!product) return toast("상품 정보를 확인할 수 없습니다.");
  if (Number(product.stock) <= 0) return toast("품절된 상품입니다.");

  const item = cart.find(entry => String(entry.id) === String(id));
  if (item) {
    if (item.qty + qty > Number(product.stock)) return toast("재고 수량을 초과했습니다.");
    item.qty += qty;
  } else {
    cart.push({ id: product.id, qty });
  }

  save("trendora_cart", cart);
  renderCart();
  toast("장바구니에 담았습니다.");
}

function changeQty(id, delta) {
  const item = cart.find(entry => String(entry.id) === String(id));
  const product = productCache.get(String(id));
  if (!item || !product) return;
  if (Number(product.stock) <= 0) return toast("품절된 상품입니다.");
  item.qty = Math.max(1, Math.min(Number(product.stock), item.qty + delta));
  save("trendora_cart", cart);
  renderCart();
}

function removeCart(id) {
  cart = cart.filter(entry => String(entry.id) !== String(id));
  save("trendora_cart", cart);
  renderCart();
}

async function loadCartProducts() {
  if (!cart.length) return;
  const ids = [...new Set(cart.map(item => item.id))];
  const { data, error } = await db
    .from("shop_products")
    .select("id,name,category,price,stock,image_url,is_active,created_at")
    .in("id", ids);

  if (error) {
    console.error(error.message);
    return;
  }
  rememberProducts(data || []);
  renderCart();
}

function cartTotal() {
  return cart.reduce((sum, item) => {
    const product = productCache.get(String(item.id));
    return sum + (product ? Number(product.price) * item.qty : 0);
  }, 0);
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  $("#cart-count").textContent = count;
  $("#drawer-count").textContent = `(${count})`;
  $("#cart-total").textContent = won(cartTotal());

  const availableItems = cart.filter(item => productCache.has(String(item.id)));
  $("#cart-items").innerHTML = !cart.length
    ? `<div class="empty-state">장바구니가 비어 있습니다.</div>`
    : availableItems.length
      ? availableItems.map(item => {
          const product = productCache.get(String(item.id));
          const soldOut = Number(product.stock) <= 0;
          return `
            <div class="cart-item">
              <img src="${escapeHtml(productImage(product.image_url))}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='${HERO_IMAGES[0]}'">
              <div>
                <h4>${escapeHtml(product.name)}</h4>
                <p>${won(product.price)}</p>
                <div class="qty-control">
                  <button data-qty="${escapeHtml(product.id)}" data-delta="-1" ${soldOut || item.qty <= 1 ? "disabled" : ""}>−</button>
                  <span>${item.qty}</span>
                  <button data-qty="${escapeHtml(product.id)}" data-delta="1" ${soldOut || item.qty >= Number(product.stock) ? "disabled" : ""}>+</button>
                </div>
                ${soldOut ? `<p>품절</p>` : ""}
              </div>
              <button class="remove-btn" data-remove="${escapeHtml(product.id)}">삭제</button>
            </div>`;
        }).join("")
      : `<div class="empty-state">장바구니 상품을 불러오는 중</div>`;
}

function openPanel(id) {
  $("#overlay").classList.add("show");
  if (id === "cart-drawer") $("#cart-drawer").classList.add("open");
  else $("#" + id).classList.add("open");
}

function closePanels() {
  $("#overlay").classList.remove("show");
  $$(".drawer,.modal").forEach(el => el.classList.remove("open"));
}

function openAuth() {
  $("#auth-content").innerHTML = `
    <h2>WELCOME TO<br>TRENDORA.</h2>
    <p class="sub">로그인하고 나만의 스타일을 시작하세요.</p>
    <form id="login-form">
      <div class="form-row"><label>이메일</label><input name="email" type="email" required placeholder="example@email.com"></div>
      <div class="form-row"><label>비밀번호</label><input name="password" type="password" required minlength="6" placeholder="비밀번호"></div>
      <button class="primary-btn">로그인</button>
    </form>
    <p class="form-switch">아직 회원이 아니신가요? <button class="text-btn" id="show-signup">회원가입</button></p>`;
  openPanel("auth-modal");
}

function signupView() {
  $("#auth-content").innerHTML = `
    <h2>JOIN TRENDORA.</h2>
    <p class="sub">가입 축하 포인트 3,000P를 드려요.</p>
    <form id="signup-form">
      <div class="form-row"><label>이름</label><input name="name" required maxlength="20" placeholder="이름"></div>
      <div class="form-row"><label>연락처</label><input name="phone" type="tel" required placeholder="010-0000-0000"></div>
      <div class="form-row"><label>이메일</label><input name="email" type="email" required placeholder="example@email.com"></div>
      <div class="form-row"><label>비밀번호 (6자 이상)</label><input name="password" type="password" required minlength="6" placeholder="비밀번호 6자 이상"></div>
      <button class="primary-btn">3,000P 받고 가입하기</button>
    </form>
    <p class="form-switch">이미 계정이 있으신가요? <button class="text-btn" id="show-login">로그인</button></p>`;
}

async function openMyPage() {
  if (!session) {
    openAuth();
    toast("마이페이지는 로그인 후 이용할 수 있습니다.");
    return;
  }
  const user = await loadProfile();
  if (!user) return;

  $("#mypage-content").innerHTML = `
    <h2>MY PAGE.</h2>
    <p class="sub">${escapeHtml(user.name)}님, TRENDORA에 오신 것을 환영합니다.</p>
    <div class="my-stats">
      <div><span>보유 포인트</span><strong>${Number(user.points || 0).toLocaleString()}P</strong></div>
      <div><span>회원 등급</span><strong>${displayGrade(user.grade)}</strong></div>
    </div>
    <p class="grade-list">이메일 · ${escapeHtml(user.email)}<br>회원 등급 · ${displayGrade(user.grade)}<br>보유 포인트 · ${Number(user.points || 0).toLocaleString()}P</p>
    <form id="profile-form">
      <div class="form-row"><label>이름</label><input name="name" value="${escapeHtml(user.name || "")}" required maxlength="20"></div>
      <div class="form-row"><label>연락처</label><input name="phone" type="tel" value="${escapeHtml(user.phone || "")}" placeholder="010-0000-0000"></div>
      <button class="primary-btn">회원 정보 저장</button>
    </form>
    <button class="primary-btn" id="logout-btn" style="margin-top:20px">로그아웃</button>`;
  openPanel("mypage-modal");
}

function checkout() {
  if (!cart.length) return toast("장바구니가 비어 있습니다.");
  if (!session) {
    closePanels();
    openAuth();
    return toast("주문하려면 먼저 로그인해 주세요.");
  }
  const user = userProfile;
  const cartLines = cart.map(item => {
    const product = productCache.get(String(item.id));
    return product ? `${escapeHtml(product.name)} × ${item.qty} — ${won(product.price * item.qty)}` : "";
  }).filter(Boolean);

  $("#checkout-content").innerHTML = `
    <h2>DEMO CHECKOUT.</h2>
    <p class="sub">실제 결제 없이 주문 내역만 저장됩니다.</p>
    <div class="order-card"><strong>주문 상품</strong><p>${cartLines.join("<br>")}</p><strong>총 결제 금액　${won(cartTotal())}</strong></div>
    <div class="form-row"><label>받는 사람</label><input id="receiver" value="${escapeHtml(user?.name || "")}" required></div>
    <div class="form-row"><label>배송 주소 (체험용)</label><input id="address" placeholder="배송 주소를 입력해 주세요" required></div>
    <button class="primary-btn" id="confirm-order">체험 주문 완료하기 <span>→</span></button>`;
  openPanel("checkout-modal");
}

function completeOrder() {
  if (!session) return;
  const receiver = $("#receiver").value.trim();
  const address = $("#address").value.trim();
  if (!receiver || !address) return toast("받는 사람과 주소를 입력해 주세요.");
  cart = [];
  save("trendora_cart", cart);
  renderCart();
  closePanels();
  toast("체험 주문이 완료되었습니다.");
}

function initSlider() {
  const slides = $$(".hero-slide");
  const dots = $("#hero-dots");
  dots.innerHTML = slides.map((_, i) => `<button aria-label="${i + 1}번 슬라이드" class="${i === 0 ? "active" : ""}" data-slide="${i}"></button>`).join("");
  function show(i) {
    slideIndex = i;
    slides.forEach((slide, n) => slide.classList.toggle("active", n === i));
    $$("button", dots).forEach((dot, n) => dot.classList.toggle("active", n === i));
  }
  function start() {
    clearInterval(slideTimer);
    slideTimer = setInterval(() => show((slideIndex + 1) % slides.length), 6000);
  }
  dots.addEventListener("click", event => {
    const button = event.target.closest("[data-slide]");
    if (button) { show(Number(button.dataset.slide)); start(); }
  });
  start();
}

document.addEventListener("click", async event => {
  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    event.preventDefault();
    setCategory(categoryButton.dataset.category);
  }

  const productCard = event.target.closest("[data-product]");
  if (productCard && !event.target.closest("[data-quick]")) {
    await openProduct(productCard.dataset.product);
  }

  const quickAdd = event.target.closest("[data-quick]");
  if (quickAdd) {
    event.stopPropagation();
    if (!quickAdd.disabled) addToCart(quickAdd.dataset.quick);
  }

  const quantityButton = event.target.closest("[data-qty]");
  if (quantityButton && !quantityButton.disabled) changeQty(quantityButton.dataset.qty, Number(quantityButton.dataset.delta));

  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) removeCart(removeButton.dataset.remove);

  if (event.target.closest("[data-close]")) closePanels();
  if (event.target.id === "overlay") closePanels();
  if (event.target.closest("[data-home]")) { event.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  if (event.target.id === "cart-btn") openPanel("cart-drawer");
  if (event.target.id === "account-btn") openAuth();
  if (event.target.id === "profile-btn") await openMyPage();

  if (event.target.id === "account-logout-btn" || event.target.id === "logout-btn") {
    const { error } = await db.auth.signOut();
    if (error) { toast(authErrorMessage(error)); return; }
    session = null;
    userProfile = null;
    renderAccountMenu();
    closePanels();
    toast("로그아웃되었습니다.");
  }

  if (event.target.id === "search-toggle") {
    $("#product-search").focus();
    $("#products").scrollIntoView({ behavior: "smooth" });
  }
  if (event.target.id === "menu-toggle") $(".main-nav").classList.toggle("open");
  if (event.target.id === "show-signup") signupView();
  if (event.target.id === "show-login") openAuth();

  if (event.target.id === "detail-add" && selectedProduct) {
    if (Number(selectedProduct.stock) <= 0) return toast("품절된 상품입니다.");
    addToCart(selectedProduct.id, Number($("#detail-qty").value));
    closePanels();
  }
  if (event.target.id === "checkout-btn") checkout();
  if (event.target.id === "confirm-order") completeOrder();
});

document.addEventListener("submit", async event => {
  if (event.target.id === "signup-form") {
    event.preventDefault();
    const formData = new FormData(event.target);
    const name = formData.get("name").trim();
    const phone = formData.get("phone").trim();
    const email = formData.get("email").trim().toLowerCase();
    const password = formData.get("password");
    const { data, error } = await db.auth.signUp({ email, password, options: { data: { name, phone } } });
    if (error) { toast(authErrorMessage(error)); return; }
    if (data.session) {
      session = data.session;
      await loadProfile();
      closePanels();
      toast("가입이 완료되었습니다. 환영합니다!");
    } else {
      closePanels();
      toast("가입 신청이 완료되었습니다. 이메일 인증 후 로그인해 주세요.");
    }
  }

  if (event.target.id === "login-form") {
    event.preventDefault();
    const formData = new FormData(event.target);
    const email = formData.get("email").trim().toLowerCase();
    const password = formData.get("password");
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) { toast(authErrorMessage(error)); return; }
    session = data.session;
    await loadProfile();
    closePanels();
    toast(`${userProfile?.name || email}님, 환영합니다!`);
  }

  if (event.target.id === "profile-form") {
    event.preventDefault();
    if (!session) return;
    const formData = new FormData(event.target);
    const name = formData.get("name").trim();
    const phone = formData.get("phone").trim();
    const { data, error } = await db
      .from("shop_profiles")
      .update({ name, phone })
      .eq("id", session.user.id)
      .select("id,email,name,phone,grade,points,role,created_at")
      .single();
    if (error) { toast("회원 정보 저장에 실패했습니다: " + error.message); return; }
    userProfile = data;
    renderAccountMenu();
    toast("회원 정보가 저장되었습니다.");
    await openMyPage();
  }
});

function authErrorMessage(error) {
  const message = (error?.message || "").toLowerCase();
  if (message.includes("already registered") || message.includes("already been registered") || message.includes("user already registered")) return "이미 가입된 이메일입니다.";
  if (message.includes("invalid login credentials") || message.includes("invalid email or password")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (message.includes("email not confirmed")) return "이메일 인증을 먼저 완료해 주세요.";
  if (message.includes("password should be at least") || message.includes("password is too short")) return "비밀번호는 6자 이상 입력해 주세요.";
  if (message.includes("rate limit")) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  return "요청을 처리하지 못했습니다. 입력 정보를 확인하고 다시 시도해 주세요.";
}

$("#product-search").addEventListener("input", loadProducts);
$("#checkout-btn").addEventListener("click", () => {});

renderCart();
initSlider();
loadProducts();
loadCartProducts();
syncSession();

db.auth.onAuthStateChange((_event, newSession) => {
  session = newSession;
  setTimeout(() => loadProfile(), 0);
});
