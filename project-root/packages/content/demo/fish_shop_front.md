---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: fish_shop_front
displayName: Fishmonger Shop Door
tagline: A shallow threshold with a little attitude.

presentation:
  forward: billboard
  backward: billboard

region: fishmonger_row

navigationLabels:
  pois: Things To Try
  choices: What You Decide
  exits: Ways Out
  controls: Threshold Controls

controlLabels:
  back: Step Away From The Door

tags:
  - shop
  - unopened
  - fishmonger

pois:
  - id: doorknock
    displayName: Knock on the Door.
  - id: businesshours
    displayName: Check the business hours?

choices:
  - id: wait
    displayName: Wait a Moment.

---

# Fishmonger Shop Door

## enter
The shop front leans into the row like it has been listening all day.

---

## billboard
No activity that you sense behind the dusted glass.

---

## poi:doorknock:1
Closed.
[delay: long]
Permanently.

## poi:doorknock:2
[none]

---

## poi:businesshours:1
What business hours?

## poi:businesshours:2
Looks like they've shuttered a long time ago. The broken window isn't just for aesthetic.

---

## choice:wait
No point waiting around.