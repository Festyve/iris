// Composition recipes use the same native text, shapes and art fills as the rest of the vault.
const FieldGuides=(()=>{
  const cafeRoles=['Home','Menu','Order','Visit'];
  const travelRoles=['Itinerary','Routes','Places'];
  const destinations={
    Kyoto:['Kyoto','Nishiki Market','Kamo River','Gion lanes'],
    Tokyo:['Tokyo','Yanaka Ginza','Ueno Park','Asakusa lanes'],
    Paris:['Paris','Marché Bastille','Canal Saint-Martin','Place des Vosges'],
    Copenhagen:['Copenhagen','Torvehallerne','Nyhavn','Designmuseum'],
    Lisbon:['Lisbon','Alfama','Miradouro da Graça','Praça do Comércio'],
    London:['London','Borough Market','Tate Modern','South Bank']
  };
  function cafe(role,name,ui){
    const {text,rect,art,rule}=ui,ink='#34291F',paper='#FFF7E8',red='#A8322D',green='#2D493B',sand='#E8D6B8';
    const pill=(value,x,y,w,bg=green,fg=paper)=>{
      rect(value+' button',x,y,w,42,bg,{r:21});text(value,x+17,y+11,w-29,16,600,fg);
    };
    const small=(s,x,y,w)=>text(s,x,y,w,15,600,green);
    rect('Café opening strip',0,0,1440,32,green);text('BAKED EACH MORNING',52,8,320,13,600,paper);text('WALK-INS WELCOME',1186,8,206,13,600,paper);
    text(name,52,48,550,42,700,red);
    ['Menu','Our beans','Visit'].forEach((s,i)=>text(s,778+i*118,65,113,17,600,ink));
    pill('Order pickup ↗',1210,49,180);rule(52,110,1336);
    function menuRow(item,note,price,x,y,w){
      rule(x,y,w);text(item,x,y+12,w-83,25,600,ink);
      text(price,x+w-64,y+16,63,18,600,ink);text(note,x,y+48,w-10,17,400,green);
    }
    if(role==='Home'){
      small('NEIGHBOURHOOD COFFEE & BAKESHOP',52,150,650);
      text('Meet me',48,194,632,102,700,ink);text('for coffee.',48,296,644,102,700,red);
      text('Espresso at the bar. Butter on the counter.',53,446,631,24,400,ink);
      pill('Browse the menu →',53,506,201);text('Find the café ↗',285,518,230,17,600,ink);
      art(0,715,131,673,452);
      text('On the counter',52,624,850,52,600,ink);
      const tiles=[['Honey oat latte','Espresso · orange blossom','$5.50'],['Butter croissant','Cultured butter · flaky layers','$4.25'],['Morning blend','Whole bean · 250 g','$18']];
      tiles.forEach(([title,desc,price],i)=>{
        const x=52+451*i;
        rect('Counter card',x,707,432,145,['#F3E5CD','#F1DFD0','#E1E6D7'][i],{r:10});
        art(i,x+10,718,132,112);text(title,x+158,728,262,24,600,ink);text(desc,x+158,769,259,15,400,green);text(price,x+158,806,103,18,600,red);
      });
    }else if(role==='Menu'){
      text('Counter menu',52,140,855,78,700,ink);
      pill('Coffee & espresso',53,251,198);pill('Bakery',267,251,103,sand,ink);pill('Beans',385,251,99,sand,ink);
      [['Flat white','Double shot, silky milk.','$4.50'],['Honey oat latte','Orange blossom honey, oat milk.','$5.50'],['Batch brew','Rotating single origin.','$3.50'],['Cold brew','Steeped overnight, served over ice.','$4.75'],['Espresso','House blend, pulled short.','$3.00']].forEach((item,i)=>menuRow(...item,53,329+i*97,704));
      art(1,812,155,575,409);small('FROM THE OVEN',815,595,400);text('Butter croissant',813,634,564,46,600,ink);
      text('Folded with cultured butter, baked until golden.',815,705,550,21,400,green);
      pill('Add to pickup · $4.25',815,769,224);
    }else if(role==='Order'){
      art(2,52,140,605,575);text('Morning blend',719,152,665,80,700,ink);
      small('HOUSE ROAST  /  WHOLE BEAN',722,262,645);text('Chocolate, toasted almond and a soft finish.',721,309,655,22,400,ink);
      rule(721,373,665);text('Bag size',721,396,520,22,600,ink);
      pill('250 g',721,452,102);pill('1 kg',840,452,94,sand,ink);
      text('Grind',721,528,400,22,600,ink);pill('Whole bean',721,581,139);pill('Filter',880,581,98,sand,ink);
      rule(721,657,665);text('Pickup subtotal',721,685,435,24,500,ink);text('$18.00',1212,675,173,37,700,ink);
      pill('Add to pickup →',721,758,208);
    }else{
      text('Come on in.',52,135,865,86,700,ink);text('Find the café',55,283,600,38,600,ink);
      text('18 Market Lane',55,350,620,28,500,ink);text('Corner of Mill Street and Market Lane',55,397,620,20,400,green);
      menuRow('Weekdays','Monday through Friday','7–17h',55,480,601);
      menuRow('Weekends','Saturday and Sunday','8–16h',55,591,601);
      pill('Get directions ↗',55,724,194);
      rect('Neighbourhood map',711,141,676,623,'#E1E7D9');
      for(let i=0;i<5;i++)rect('City block street',741+i*130,152,14,595,paper);
      for(let i=0;i<4;i++)rect('Cross street',720,220+i*137,650,15,paper);
      rect('Park',914,331,139,117,'#B8CAA7',{r:18});rect('Market Lane',735,483,630,26,'#F7DFB5');
      text('MARKET LANE',774,487,252,15,600,ink);text('MILL STREET',1086,707,230,15,600,green);
      rect('Café pin',1066,474,45,45,red,{shape:'ellipse'});rect('Pin centre',1081,489,15,15,paper,{shape:'ellipse'});
      pill(name,1036,418,218,green,paper);
      art(0,726,643,97,82);
    }
  }
  function travel(role,name,ui,city='Kyoto'){
    const {text,rect,rule,art}=ui,[place,...stops]=destinations[city]||destinations.Kyoto;
    const ink='#163A41',paper='#F5F3E8',gold='#E9A659',sea='#D6E7DE',teal='#275C59';
    rect('Planner sidebar',0,0,239,900,ink);
    text(name,28,40,187,36,700,paper);
    ['Itinerary','Routes','Places'].forEach((s,i)=>{
      if(s===role)rect('Current view',17,154+i*61,203,47,teal,{r:9});
      text(s,36,166+i*61,170,19,600,paper);
    });
    text('MY TRIPS',29,390,180,13,700,gold);text(place,29,428,182,22,600,paper);
    text('Trip workspace  /  '+place,279,42,785,17,500,teal);
    text(place+' in three days',276,99,1075,72,700,ink);
    const labels=['Day 1','Day 2','Day 3'];
    labels.forEach((s,i)=>{rect('Day tab',280+i*116,219,101,40,i===0?ink:sea,{r:20});text(s,300+i*116,229,72,17,600,i===0?paper:ink);});
    if(role==='Itinerary'){
      text('Day one',280,301,535,40,600,ink);
      stops.forEach((s,i)=>{
        const y=387+i*136;
        rect('Timeline connector',300,y,3,i===2?24:136,teal);rect('Stop marker',286,y,31,31,gold,{shape:'ellipse'});
        text(String(i+1),296,y+5,16,16,700,ink);
        text(['09:00','12:30','16:00'][i],338,y,105,18,600,teal);text(s,337,y+32,431,30,600,ink);
        text(['Morning walk','Lunch stop','Afternoon visit'][i],338,y+79,396,17,400,teal);
      });
      rect('Route map',811,293,577,473,sea,{r:14});
      for(let i=0;i<6;i++)rect('Map street',837+i*101,316,10,426,paper);
      for(let i=0;i<5;i++)rect('Cross street',822,335+i*90,551,9,paper);
      const points=[[884,663],[1066,551],[1237,431]];
      points.forEach(([x,y],i)=>{if(i<2){const [nx,ny]=points[i+1];rect('Walk east',x,y,nx-x,5,teal);rect('Walk north',nx,ny,5,y-ny+5,teal);}});
      points.forEach(([x,y],i)=>{rect('Numbered stop',x-15,y-15,35,35,ink,{shape:'ellipse'});text(String(i+1),x-4,y-9,20,19,600,paper);});
      text('Day 1 route',837,316,257,23,600,ink);text('Schematic walking route',818,782,530,16,400,teal);
    }else if(role==='Routes'){
      text(stops[0]+'  →  '+stops[1],280,307,1085,40,600,ink);
      text('Compare sample routes',280,376,1070,20,400,teal);
      ['Walk','Transit','Cycle'].forEach((mode,i)=>{
        const y=450+i*112;rule(280,y,1095);
        rect('Mode marker',282,y+29,23,23,i===0?gold:sea,{shape:'ellipse'});
        text(mode,328,y+23,308,30,600,ink);
        text(['Scenic route','One connection','Direct route'][i],671,y+28,370,22,400,teal);
        text(['35 min','18 min','12 min'][i],1170,y+24,190,25,600,ink);
      });
    }else{
      text('Saved places',280,303,1041,46,600,ink);
      stops.forEach((s,i)=>{const x=280+371*i;art(i,x,403,344,264);text(s,x,697,343,27,600,ink);text(['Walk','Market stop','Explore'][i],x,756,311,18,400,teal);});
    }
  }
  return {cafe,travel,cafeRoles,travelRoles,destinations};
})();
