# Диаграммы Mermaid

## Блок-схема

```mermaid
flowchart LR
    A[Двойной клик по .md] --> B{Есть диаграммы?}
    B -- да --> C[Загрузить mermaid]
    B -- нет --> D[Показать сразу]
    C --> D
```

## Последовательность

```mermaid
sequenceDiagram
    participant П as Пользователь
    participant О as Окно
    participant Д as Движок Edge
    П->>О: открыть файл
    О->>Д: страница с HTML
    Д-->>П: готовый текст
```

## Диаграмма Ганта

```mermaid
gantt
    title План релизов
    dateFormat YYYY-MM-DD
    section Просмотрщик
    Иконка и темы      :done, 2026-11-25, 1d
    Подсветка кода     :done, 2026-11-25, 1d
    Диаграммы          :active, 2026-11-25, 1d
```

## Круговая

```mermaid
pie title Языки в проекте
    "C#" : 45
    "JavaScript" : 30
    "CSS" : 25
```

## Ошибка в диаграмме

```mermaid
flowchart LR
    A --> --> B
```

## Обычный код рядом

```bsl
Сообщить("Диаграммы не мешают подсветке");
```
