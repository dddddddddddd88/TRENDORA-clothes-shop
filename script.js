// TRENDORA 쇼핑몰 데이터: 상품과 회원 등급은 이 배열에서 관리합니다.
const PRODUCTS = [
  {id:1,name:"베이직 꽈지 집업 니트",category:"TOP",price:29000,stock:24,image:"./img/product-01.jpg",badge:"BEST",description:"포근한 니트 소재와 깔끔한 집업 디자인으로 데일리하게 입기 좋은 아이템입니다."},
  {id:2,name:"오버핏 후드 집업",category:"TOP",price:34000,stock:18,image:"./img/product-02.jpg",badge:"NEW",description:"여유로운 오버핏과 캐주얼한 무드가 돋보이는 데일리 후드 집업입니다."},
  {id:3,name:"루즈핏 니트",category:"TOP",price:27000,stock:35,image:"./img/product-03.jpg",badge:"BEST",description:"자연스럽게 흐르는 실루엣과 부드러운 터치감이 매력적인 루즈핏 니트입니다."},
  {id:4,name:"무지 셔츠 블라우스",category:"TOP",price:24000,stock:20,image:"./img/product-04.jpg",badge:"NEW",description:"단정한 카라와 베이직한 디자인으로 출근룩과 데일리룩 모두 활용하기 좋습니다."},
  {id:5,name:"와이드 핀턱 팬츠",category:"BOTTOM",price:39000,stock:27,image:"./img/product-05.jpg",badge:"BEST",description:"여유롭게 떨어지는 와이드 핏과 핀턱 디테일이 멋스러운 팬츠입니다."},
  {id:6,name:"크롭 후드 집업",category:"TOP",price:32000,stock:12,image:"./img/product-06.jpg",badge:"NEW",description:"가볍게 걸치기 좋은 루즈한 후드 집업으로 편안한 캐주얼 룩을 완성해 줍니다."},
  {id:7,name:"데일리 숄더백",category:"ACC",price:28000,stock:16,image:"./img/product-07.jpg",badge:"",description:"미니멀한 디자인과 데일리 룩에 자연스럽게 어울리는 숄더백 스타일을 담았습니다."},
  {id:8,name:"울 블렌드 코트",category:"OUTER",price:79000,stock:40,image:"./img/product-08.jpg",badge:"NEW",description:"차분한 컬러와 여유로운 핏으로 겨울 스타일링에 활용하기 좋은 코트입니다."}
];
const MEMBER_GRADES = [
  {name:"WELCOME",min:0,rate:1},
  {name:"SILVER",min:100000,rate:3},
  {name:"GOLD",min:300000,rate:5},
  {name:"VIP",min:700000,rate:7}
];
const SIGNUP_POINT = 3000;
const STORAGE = {users:"trendora_users",current:"trendora_current",cart:"trendora_cart",orders:"trendora_orders"};
const won = n => `${Number(n||0).toLocaleString("ko-KR")}원`;
const read = (key,fallback) => {try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}};
const save = (key,value) => localStorage.setItem(key,JSON.stringify(value));
let users=read(STORAGE.users,[]), currentUser=read(STORAGE.current,null), cart=read(STORAGE.cart,[]), orders=read(STORAGE.orders,[]);
let selectedCategory="ALL", activeProduct=null, authMode="login", heroIndex=0, heroTimer=null, toastTimer=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2200)}
function user(){return users.find(u=>u.username===currentUser)||null}
function userOrders(){return orders.filter(o=>o.username===currentUser)}
function spentTotal(){return userOrders().reduce((sum,o)=>sum+o.total,0)}
function gradeFor(total){return [...MEMBER_GRADES].reverse().find(g=>total>=g.min)||MEMBER_GRADES[0]}
function pointsTotal(){return user()?.points||0}
function updateCartCount(){const count=cart.reduce((s,i)=>s+i.qty,0);$("#cart-count").textContent=count;$("#drawer-count").textContent=count}
function renderProducts(){
 const term=$("#search-input").value.trim().toLowerCase();let list=PRODUCTS.filter(p=>(selectedCategory==="ALL"||p.category===selectedCategory)&&(`${p.name} ${p.description} ${p.category}`).toLowerCase().includes(term));
 const sort=$("#sort-select").value;if(sort==="low")list.sort((a,b)=>a.price-b.price);if(sort==="high")list.sort((a,b)=>b.price-a.price);if(sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name,"ko"));
 $("#product-grid").innerHTML=list.map(p=>`<article class="product-card" data-product="${p.id}"><div class="product-image"><img src="${p.image}" alt="${p.name}" loading="lazy"><span class="heart-mark" aria-hidden="true">♡</span>${p.badge?`<span class="product-badge">${p.badge}</span>`:""}</div><div class="product-info"><div class="product-category">${p.category}</div><h3 class="product-name">${p.name}</h3><div class="product-price">${won(p.price)}</div><p class="product-desc">${p.description}</p></div></article>`).join("");
 $("#empty-message").classList.toggle("hidden",list.length>0);
 $$(".product-card").forEach(card=>card.addEventListener("click",()=>openProduct(Number(card.dataset.product))));
}
function selectCategory(category){selectedCategory=category;$$("[data-category]").forEach(b=>b.classList.toggle("active",b.dataset.category===category));$$("[data-category-link]").forEach(a=>a.classList.toggle("active",a.dataset.categoryLink===category));renderProducts()}
function openOverlay(){ $("#overlay").classList.remove("hidden")}
function closeAll(){ $$(".drawer.open").forEach(d=>{d.classList.remove("open");d.setAttribute("aria-hidden","true")});$$(".modal:not(.hidden)").forEach(m=>m.classList.add("hidden"));$("#overlay").classList.add("hidden");document.body.style.overflow=""}
function showModal(id){closeAll();$("#"+id).classList.remove("hidden");openOverlay();document.body.style.overflow="hidden"}
function openCart(){closeAll();$("#cart-drawer").classList.add("open");$("#cart-drawer").setAttribute("aria-hidden","false");openOverlay();document.body.style.overflow="hidden";renderCart()}
function renderCart(){
 updateCartCount();const box=$("#cart-items");
 if(!cart.length){box.innerHTML='<div class="empty-message">장바구니가 비어 있습니다.</div>';$("#cart-total").textContent=won(0);return}
 box.innerHTML=cart.map(item=>{const p=PRODUCTS.find(x=>x.id===item.id);if(!p)return"";return `<div class="cart-item"><img src="${p.image}" alt="${p.name}"><div><h3>${p.name}</h3><p>${won(p.price)}</p><div class="quantity-control"><button data-qty="${p.id}" data-delta="-1" aria-label="수량 줄이기">−</button><span>${item.qty}</span><button data-qty="${p.id}" data-delta="1" aria-label="수량 늘리기">＋</button></div></div><button class="remove-item" data-remove="${p.id}">삭제</button></div>`}).join("");
 $("#cart-total").textContent=won(cart.reduce((s,i)=>s+PRODUCTS.find(p=>p.id===i.id).price*i.qty,0));
 $$("[data-qty]").forEach(b=>b.addEventListener("click",()=>changeQty(Number(b.dataset.qty),Number(b.dataset.delta))));
 $$("[data-remove]").forEach(b=>b.addEventListener("click",()=>{cart=cart.filter(i=>i.id!==Number(b.dataset.remove));save(STORAGE.cart,cart);renderCart()}));
}
function changeQty(id,delta){const item=cart.find(i=>i.id===id),p=PRODUCTS.find(x=>x.id===id);if(!item)return;item.qty=Math.max(1,Math.min(p.stock,item.qty+delta));save(STORAGE.cart,cart);renderCart()}
function addToCart(id,qty){const p=PRODUCTS.find(x=>x.id===id);if(!p||qty<1)return;const existing=cart.find(i=>i.id===id);if(existing)existing.qty=Math.min(p.stock,existing.qty+qty);else cart.push({id,qty:Math.min(p.stock,qty)});save(STORAGE.cart,cart);updateCartCount();toast("장바구니에 담았습니다.")}
function openProduct(id){activeProduct=PRODUCTS.find(p=>p.id===id);if(!activeProduct)return;$("#product-detail").innerHTML=`<div class="product-detail-layout"><img src="${activeProduct.image}" alt="${activeProduct.name}"><div class="detail-copy"><div class="product-category">${activeProduct.category}</div><h2>${activeProduct.name}</h2><div class="detail-price">${won(activeProduct.price)}</div><p>${activeProduct.description}</p><div class="detail-stock">재고 ${activeProduct.stock}개 · 체험용 상품</div><div class="detail-actions"><input id="detail-qty" type="number" min="1" max="${activeProduct.stock}" value="1" aria-label="수량"><button class="black-button" id="detail-add">장바구니 담기 →</button></div></div></div>`;showModal("product-modal");$("#detail-add").addEventListener("click",()=>{addToCart(id,Math.max(1,Math.min(activeProduct.stock,Number($("#detail-qty").value)||1)));closeAll()})}
function setAuthMode(mode){authMode=mode;$$("[data-auth]").forEach(b=>b.classList.toggle("active",b.dataset.auth===mode));$("#auth-title").textContent=mode==="login"?"LOGIN":"JOIN US";$("#auth-submit").textContent=mode==="login"?"로그인하기":"회원가입하고 3,000P 받기";$("#name-field").classList.toggle("hidden",mode==="login");$("#name-field input").required=mode==="signup"}
function openAuth(mode="login"){setAuthMode(mode);$("#auth-form").reset();showModal("auth-modal")}
$("#auth-form").addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.currentTarget),username=String(fd.get("username")).trim(),password=String(fd.get("password"));if(authMode==="signup"){if(users.some(u=>u.username===username)){toast("이미 사용 중인 아이디입니다.");return}users.push({username,password,name:String(fd.get("name")).trim(),points:SIGNUP_POINT});save(STORAGE.users,users);currentUser=username;save(STORAGE.current,currentUser);toast("가입 완료! 3,000P가 지급되었습니다.");closeAll()}else{const found=users.find(u=>u.username===username&&u.password===password);if(!found){toast("아이디 또는 비밀번호를 확인해 주세요.");return}currentUser=username;save(STORAGE.current,currentUser);toast("로그인되었습니다.");closeAll()}});
function openMypage(){if(!user()){openAuth("login");return}const u=user(),grade=gradeFor(spentTotal()),myOrders=userOrders();$("#mypage-content").innerHTML=`<div class="mypage-user"><b>${u.name||u.username}님, 안녕하세요.</b><p>${grade.name} 회원 · 누적 주문 ${won(spentTotal())}</p></div><div class="point-card"><span>보유 포인트</span><strong>${pointsTotal().toLocaleString("ko-KR")}P</strong></div><div class="point-card"><span>현재 등급 적립률</span><strong>${grade.rate}%</strong></div><div class="point-card"><span>다음 등급까지</span><strong>${grade.name==="VIP"?"최고 등급":won(MEMBER_GRADES[MEMBER_GRADES.indexOf(grade)+1].min-spentTotal())}</strong></div><div class="order-list"><h3>주문 내역 (${myOrders.length})</h3>${myOrders.length?myOrders.slice().reverse().map(o=>`<div class="order-entry"><b>${o.id}</b> · ${won(o.total)}<br><span>${o.date} · ${o.items.map(i=>i.name+" × "+i.qty).join(", ")}</span></div>`).join(""):'<p class="form-note">아직 주문 내역이 없습니다.</p>'}</div><button class="logout-button" id="logout-button">로그아웃</button>`;showModal("mypage-modal");$("#logout-button").addEventListener("click",()=>{currentUser=null;localStorage.removeItem(STORAGE.current);closeAll();toast("로그아웃되었습니다.")})}
function openCheckout(){if(!cart.length){toast("장바구니가 비어 있습니다.");return}if(!user()){openAuth("login");toast("결제를 진행하려면 로그인해 주세요.");return}const total=cart.reduce((s,i)=>s+PRODUCTS.find(p=>p.id===i.id).price*i.qty,0);$("#checkout-summary").innerHTML=cart.map(i=>{const p=PRODUCTS.find(x=>x.id===i.id);return `${p.name} × ${i.qty} — ${won(p.price*i.qty)}`}).join("<br>");$("#checkout-total").textContent=won(total);showModal("checkout-modal")}
$("#checkout-form").addEventListener("submit",e=>{e.preventDefault();if(!user())return;const fd=new FormData(e.currentTarget),items=cart.map(i=>{const p=PRODUCTS.find(x=>x.id===i.id);return{id:p.id,name:p.name,price:p.price,qty:i.qty}}),total=items.reduce((s,i)=>s+i.price*i.qty,0),grade=gradeFor(spentTotal()),earned=Math.floor(total*grade.rate/100);const order={id:"TR"+Date.now().toString().slice(-8),username:currentUser,date:new Date().toLocaleString("ko-KR"),buyer:fd.get("buyer"),phone:fd.get("phone"),address:fd.get("address"),items,total,earned};orders.push(order);save(STORAGE.orders,orders);users=users.map(u=>u.username===currentUser?{...u,points:u.points+earned}:u);save(STORAGE.users,users);cart=[];save(STORAGE.cart,cart);closeAll();e.currentTarget.reset();toast(`주문이 저장되었습니다! ${earned.toLocaleString("ko-KR")}P 적립`);updateCartCount()});
function setSlide(index){const slides=$$(".hero-slide");heroIndex=(index+slides.length)%slides.length;slides.forEach((s,i)=>s.classList.toggle("active",i===heroIndex));$("#slide-number").textContent=String(heroIndex+1).padStart(2,"0");$("#slide-progress").style.width=`${(heroIndex+1)*25}%`}
function startSlider(){clearInterval(heroTimer);heroTimer=setInterval(()=>setSlide(heroIndex+1),6000)}
$("#slide-prev").addEventListener("click",()=>{setSlide(heroIndex-1);startSlider()});$("#slide-next").addEventListener("click",()=>{setSlide(heroIndex+1);startSlider()});
$("#search-toggle").addEventListener("click",()=>{$("#search-panel").classList.toggle("show");if($("#search-panel").classList.contains("show"))$("#search-input").focus()});
$("#search-input").addEventListener("input",renderProducts);$("#search-clear").addEventListener("click",()=>{$("#search-input").value="";renderProducts()});$("#sort-select").addEventListener("change",renderProducts);
$$("[data-category]").forEach(b=>b.addEventListener("click",()=>selectCategory(b.dataset.category)));
$$("[data-category-link]").forEach(a=>a.addEventListener("click",()=>selectCategory(a.dataset.categoryLink)));
$("#cart-open").addEventListener("click",openCart);$("#checkout-open").addEventListener("click",openCheckout);$("#login-open").addEventListener("click",()=>openAuth("login"));$("#mypage-open").addEventListener("click",openMypage);
$("#overlay").addEventListener("click",closeAll);$$("[data-close]").forEach(b=>b.addEventListener("click",closeAll));$$("[data-auth]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.auth)));
$("#mobile-menu").addEventListener("click",()=>$(".main-nav").classList.toggle("mobile-open"));
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAll()});
renderProducts();updateCartCount();startSlider();
