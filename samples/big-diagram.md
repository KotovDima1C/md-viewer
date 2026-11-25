# Большая схема: подсистемы ERP и потоки данных между ними

Пример для проверки больших схем: типовая ERP-система — контуры, подсистемы внутри них и документы, которые передают данные из одной подсистемы в другую. Схема заметно шире колонки текста: она должна раскрыться на всю ширину окна, читаться в натуральную величину и прокручиваться.

Цвета задаёт сам файл через `classDef` — по контуру: коммерция, склад, производство, финансы, персонал, нормативно-справочная информация.

## Схема

```mermaid
flowchart LR
  classDef nsi fill:#ede9fe,stroke:#7c3aed,color:#1e1b4b
  classDef com fill:#dbeafe,stroke:#2563eb,color:#0f172a
  classDef wh fill:#cffafe,stroke:#0891b2,color:#083344
  classDef prod fill:#fef3c7,stroke:#d97706,color:#451a03
  classDef fin fill:#dcfce7,stroke:#16a34a,color:#052e16
  classDef hr fill:#fce7f3,stroke:#db2777,color:#500724
  classDef ext fill:#f1f5f9,stroke:#64748b,color:#0f172a,stroke-dasharray:5 5

  subgraph NSI["Нормативно-справочная информация"]
    direction TB
    nom["Номенклатура"]
    partners["Партнёры и контрагенты"]
    orgs["Организации и подразделения"]
    prices["Виды цен и соглашения"]
  end

  subgraph COM["Коммерция"]
    direction TB
    crm["CRM: интересы и сделки"]
    order["Заказ клиента"]
    sale["Реализация товаров и услуг"]
    ret["Возврат от клиента"]
    supplyPlan["План закупок"]
    supOrder["Заказ поставщику"]
    receipt["Приобретение товаров"]
  end

  subgraph WH["Склад и логистика"]
    direction TB
    reserve["Резервирование"]
    pick["Отбор и размещение (WMS)"]
    move["Перемещение между складами"]
    inv["Инвентаризация"]
    ship["Доставка и маршрутные листы"]
  end

  subgraph PROD["Производство"]
    direction TB
    spec["Ресурсные спецификации"]
    mps["Главный план производства"]
    stage["Этапы производства"]
    output["Выпуск продукции"]
    repair["Ремонты оборудования"]
  end

  subgraph FIN["Финансы"]
    direction TB
    budget["Бюджетирование"]
    treasury["Казначейство: заявки на оплату"]
    bank["Банковские выписки"]
    settle["Взаиморасчёты"]
    cost["Себестоимость и финансовый результат"]
    reg["Регламентированный учёт и отчётность"]
    ifrs["Международный учёт (МСФО)"]
  end

  subgraph HR["Персонал"]
    direction TB
    staff["Кадровый учёт"]
    time["Учёт рабочего времени"]
    payroll["Начисление зарплаты"]
  end

  subgraph EXT["Внешние системы"]
    direction TB
    site["Интернет-магазин"]
    mp["Маркетплейсы"]
    edo["ЭДО"]
    bankClient["Банк-клиент"]
    fns["Отчётность в ФНС"]
  end

  nom --> order & supOrder & spec
  partners --> crm & settle
  prices --> order
  orgs --> reg & staff

  site --> order
  mp --> order
  crm --> order
  order --> reserve --> pick --> sale
  sale --> ship
  sale --> settle
  sale --> edo
  ret --> settle

  order --> mps
  mps --> supplyPlan --> supOrder --> receipt
  receipt --> pick
  receipt --> settle
  edo --> receipt
  mps --> stage
  spec --> stage --> output --> pick
  repair --> stage
  move --> pick
  inv --> cost

  settle --> treasury --> bankClient --> bank --> settle
  budget --> treasury
  output --> cost
  sale --> cost
  receipt --> cost
  cost --> reg --> fns
  reg --> ifrs

  staff --> time --> payroll
  stage --> time
  payroll --> cost
  payroll --> treasury

  class nom,partners,orgs,prices nsi
  class crm,order,sale,ret,supplyPlan,supOrder,receipt com
  class reserve,pick,move,inv,ship wh
  class spec,mps,stage,output,repair prod
  class budget,treasury,bank,settle,cost,reg,ifrs fin
  class staff,time,payroll hr
  class site,mp,edo,bankClient,fns ext
```

## Обычный текст после схемы

Колонка текста остаётся прежней ширины — на всю ширину окна раскрывается только диаграмма. Наведите на неё: слева вверху появится панель масштаба (−, 100%, +, ↔), двойной клик переключает «натуральный размер» и «вписать по ширине», `Ctrl+колесо` над схемой меняет масштаб.
