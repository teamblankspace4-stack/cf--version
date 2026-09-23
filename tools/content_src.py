# Single source of truth for lesson content. build_content.py turns this into
# content/<code>.json (used by the app) and assets/media/<code>-lesson.mp4.
CONTENT = {
"RAD-101": {
  "video_title": "Doppler Weather Radar operations",
  "chapters": [
    {"title": "What a Doppler Weather Radar measures",
     "points": ["Reflectivity: how much energy comes back (dBZ)", "Radial velocity: motion toward or away from the radar", "Spectrum width: turbulence within the beam"],
     "keywords": ["dwr", "reflectivity", "velocity", "doppler", "s-band", "c-band", "pulse", "echo", "basics"],
     "text": "A Doppler Weather Radar sends out short pulses of microwave energy and listens for the echo. The strength of the echo gives reflectivity, measured in dBZ, which tells us how much precipitation is in the beam. The shift in the returned signal gives radial velocity, the motion of targets toward or away from the radar. IMD operates both S-band and C-band radars. S-band suffers less attenuation in very heavy rain, which is why it suits cyclone-prone coasts."},
    {"title": "The volume scan strategy",
     "points": ["Antenna turns 360° at a series of elevation angles", "Lowest elevations see closest to the ground", "One full volume every few minutes"],
     "keywords": ["scan", "volume", "elevation", "angle", "antenna", "sweep", "strategy", "vcp", "beam", "blockage"],
     "text": "In a volume scan, the antenna rotates through a full circle at one elevation angle, then steps up to the next angle and repeats. The lowest elevations matter most, because they see rain closest to the ground, but they are also the ones blocked by hills and buildings. One complete volume takes a few minutes, and the station SOP fixes which scan strategy to run in normal weather and which to switch to during severe weather."},
    {"title": "Pre-shift checks",
     "points": ["Transmitter, antenna and servo status", "Open alarms and the previous shift's notes", "Data reaching the central server on time"],
     "keywords": ["check", "shift", "start", "status", "transmitter", "server", "time", "sync", "logbook", "before"],
     "text": "Before taking over a shift, read the previous shift's notes in the logbook first. Then check transmitter status, antenna and servo health, and the list of open alarms. Confirm that the latest volume has reached the central server and that the radar clock is synchronised, because products with the wrong time are worse than no products. Record anything unusual before you start work."},
    {"title": "Reading reflectivity",
     "points": ["Around 20 dBZ: light rain", "40 dBZ and above: moderate to heavy rain", "50 dBZ and above: very heavy rain, possible hail"],
     "keywords": ["reflectivity", "dbz", "rain", "intensity", "hail", "heavy", "bright", "band", "melting", "colour"],
     "text": "Reflectivity is shown in colours by dBZ. Values around 20 usually mean light rain, 40 and above indicate moderate to heavy rain, and 50 and above suggest very heavy rain and possibly hail. Watch for the bright band, a ring of enhanced reflectivity where snow melts into rain. It makes rain look heavier than it is, so do not read it as a real intensity peak."},
    {"title": "Reading radial velocity and aliasing",
     "points": ["Colours show motion toward and away from the radar", "Nyquist velocity sets the largest speed measured cleanly", "Aliasing: a sudden jump from strong inbound to strong outbound"],
     "keywords": ["velocity", "radial", "aliasing", "folding", "nyquist", "inbound", "outbound", "wind", "doppler", "unfold"],
     "text": "Velocity products colour motion toward the radar differently from motion away from it. Every radar has a Nyquist velocity, the largest speed it can measure without ambiguity. When winds exceed it, the value folds over, and you see a sudden jump from strong inbound to strong outbound next to each other. That is aliasing, not a real wind shift. Check neighbouring gates and use the unfolded product before drawing conclusions."},
    {"title": "Handling routine alarms",
     "points": ["Sort alarms: information or service-affecting", "Follow the station SOP step by step", "Log the time and escalate to engineering"],
     "keywords": ["alarm", "fault", "error", "warning", "escalate", "engineering", "sop", "restart", "failure"],
     "text": "Alarms fall into two groups: information messages that need a log entry, and faults that affect the service. For a service-affecting alarm, follow the station SOP step by step, note the time it started, and escalate to the engineering team. Never power-cycle the transmitter outside the documented procedure. A wrong restart can damage hardware and lose hours of data."},
    {"title": "Handing over a shift safely",
     "points": ["Radar status and open alarms", "Current weather and products issued", "Pending tasks, signed by both officers"],
     "keywords": ["handover", "shift", "log", "logbook", "sign", "note", "pending", "end", "relieve"],
     "text": "A safe handover covers the radar status, any open alarms, the current weather situation, the products already issued, and tasks still pending. Write it in the logbook and walk the incoming officer through it on screen. Both officers sign. A handover note that only says all normal is not a handover."}
  ],
  "reading": {
    "title": "Field reference notes: DWR shift checklist",
    "html": "<h3>Start of shift</h3><ul><li>Read the previous shift's logbook entries and open alarms.</li><li>Check transmitter, antenna and servo status on the control screen.</li><li>Confirm the latest volume scan reached the central server on time.</li><li>Confirm the radar clock is synchronised.</li></ul><h3>During the shift</h3><ul><li>Review reflectivity and velocity products after every volume.</li><li>Treat sudden inbound/outbound pairs as possible aliasing until checked.</li><li>Log every alarm with its start time, action taken, and whether it cleared.</li><li>Switch to the severe-weather scan strategy when the SOP criteria are met.</li></ul><h3>Reflectivity guide</h3><table><thead><tr><th>dBZ</th><th>Usual meaning</th></tr></thead><tbody><tr><td>About 20</td><td>Light rain</td></tr><tr><td>40 and above</td><td>Moderate to heavy rain</td></tr><tr><td>50 and above</td><td>Very heavy rain, possible hail</td></tr></tbody></table><p>Always check a strong ring of reflectivity against the melting level before treating it as heavy rain. It may be the bright band.</p><h3>End of shift</h3><ul><li>Write the handover: status, open alarms, weather situation, products issued, pending tasks.</li><li>Walk the incoming officer through it and both sign the logbook.</li></ul>"
  },
  "quiz": [
    {"q": "Which radar product shows motion toward or away from the radar?", "options": ["Reflectivity", "Radial velocity", "Spectrum width", "Echo top height"], "answer": 1,
     "explain": "Radial velocity measures the component of motion along the beam, toward or away from the radar."},
    {"q": "On the velocity display you see strong inbound values right next to strong outbound values. What should you suspect first?", "options": ["A tornado", "A calibration fault", "Velocity aliasing", "Bright band"], "answer": 2,
     "explain": "When speeds exceed the Nyquist velocity they fold over. Check neighbouring gates and the unfolded product first."},
    {"q": "Why are the lowest elevation angles in a volume scan the most important?", "options": ["They are the fastest to scan", "They see precipitation closest to the ground", "They never suffer blockage", "They measure hail directly"], "answer": 1,
     "explain": "Low elevations sample near the surface, where rain affects people, though they are also most prone to blockage."},
    {"q": "A service-affecting alarm appears on the transmitter. What is the correct first action?", "options": ["Power-cycle the transmitter immediately", "Ignore it until the next shift", "Follow the station SOP, log the time and escalate", "Switch off the radar"], "answer": 2,
     "explain": "Follow the documented procedure, record when it started and escalate. Unplanned restarts can damage hardware."},
    {"q": "Reflectivity values of 50 dBZ and above usually indicate:", "options": ["Drizzle", "Light rain", "Very heavy rain and possible hail", "Clear air echoes"], "answer": 2,
     "explain": "50 dBZ and above suggests very heavy rain and possibly hail."}
  ],
  "practical": {
    "title": "Practical task: log one volume scan and write a handover",
    "task": "During one of your shifts, capture the reflectivity and velocity products from a single volume scan at your station, identify one feature in them, and write the handover note you would give the next officer.",
    "steps": ["Photograph or screenshot the lowest-elevation reflectivity and velocity products from the same volume.", "Identify one feature: an area of heavy rain, bright band, blockage, or aliasing. Say how you recognised it.", "Write a complete handover note: radar status, open alarms, weather situation, products issued, pending tasks."],
    "evidence": "Upload a photo of the products or your logbook page, and type your findings and handover note."
  }
},
"AWS-201": {
  "video_title": "Surface instruments: calibration and preventive maintenance",
  "chapters": [
    {"title": "Why calibration matters",
     "points": ["Sensors drift slowly and silently", "Station data feeds forecasts and the climate record", "Every reading must trace back to a reference"],
     "keywords": ["calibration", "calibrate", "drift", "accuracy", "error", "traceability", "why", "quality"],
     "text": "Every sensor drifts. A barometer or thermometer that was accurate on the day it was installed can slowly read high or low, and nothing on the display tells you. Station data feeds forecasts, warnings and the long-term climate record, so a small silent error spreads a long way. Calibration compares the station sensor with a reference and records the correction, so every reading can be traced back to a known standard."},
    {"title": "Reference standards and traceability",
     "points": ["Use a travelling reference or certified standard", "Compare side by side in stable conditions", "Record reading, reference, difference and correction"],
     "keywords": ["reference", "standard", "traveling", "travelling", "certified", "traceability", "compare", "correction", "certificate"],
     "text": "Calibration in the field uses a reference instrument that has itself been calibrated against a higher standard, often a travelling standard brought to the station. Place the reference beside the station sensor, wait for conditions to stabilise, and take several paired readings. Record the station reading, the reference reading, the difference and the correction applied, along with the reference instrument's certificate number."},
    {"title": "Pressure: checking the barometer",
     "points": ["Take paired readings in steady weather", "Confirm the station height used for reduction", "Apply corrections within the SOP tolerance"],
     "keywords": ["pressure", "barometer", "hpa", "station", "level", "msl", "sea", "height", "reduction"],
     "text": "For pressure, choose a period of steady weather, not the passage of a front. Take several paired readings between the station barometer and the reference, a few minutes apart. Check that the station height used to reduce pressure to mean sea level matches the station record, because a wrong height gives a constant error in every reported value. If the difference is outside the tolerance in the station SOP, record it and report the sensor for adjustment."},
    {"title": "Temperature and humidity",
     "points": ["Sensor inside a clean, ventilated radiation screen", "Mounted between 1.25 and 2 metres above ground", "Compare against an aspirated reference"],
     "keywords": ["temperature", "humidity", "thermometer", "screen", "stevenson", "radiation", "shield", "height", "ventilation", "psychrometer"],
     "text": "Temperature and humidity sensors must sit inside a radiation screen, mounted between one point two five and two metres above the ground over natural surface. A dirty or blocked screen traps heat and gives readings that are too warm on sunny days. Clean the screen, check the ventilation, and compare the sensors with an aspirated reference. Humidity sensors age faster than temperature sensors, so check them more often."},
    {"title": "Rain gauge: the tipping bucket",
     "points": ["Level the gauge and clear the funnel and filter", "Pour a known volume slowly and count the tips", "Compare with the manual standard gauge"],
     "keywords": ["rain", "rainfall", "gauge", "tipping", "bucket", "funnel", "precipitation", "mm", "tips", "level"],
     "text": "A tipping bucket gauge counts small fixed amounts of rain. First check that it is level and that the funnel and filter are free of leaves, insects and dust. Then pour a known volume of water slowly through the funnel and count the tips. Compare the count with what the volume should produce. Finally, compare the gauge's totals over several rain days with the manual standard rain gauge at the station."},
    {"title": "The preventive maintenance log",
     "points": ["Daily, weekly and monthly tasks on a fixed schedule", "Record what, when, who, and before-and-after values", "Logs let data users trust or flag readings"],
     "keywords": ["maintenance", "preventive", "log", "logbook", "schedule", "record", "daily", "weekly", "monthly", "parts"],
     "text": "Preventive maintenance works only when it follows a schedule and is written down. Keep daily, weekly and monthly tasks in the station maintenance log. For each task, record what was done, when, by whom, the readings before and after, and any part replaced. When a data user later sees a jump in the record, this log is how they decide whether to trust the value or flag it."}
  ],
  "reading": {
    "title": "Field reference notes: calibration record sheet",
    "html": "<h3>Before you start</h3><ul><li>Note the reference instrument and its certificate number.</li><li>Choose steady weather: no frontal passage, no rain for pressure checks.</li></ul><h3>For each sensor, record</h3><table><thead><tr><th>Field</th><th>Example</th></tr></thead><tbody><tr><td>Sensor and serial number</td><td>Barometer, serial as on label</td></tr><tr><td>Station reading</td><td>Value shown by the station sensor</td></tr><tr><td>Reference reading</td><td>Value shown by the reference at the same time</td></tr><tr><td>Difference</td><td>Station minus reference</td></tr><tr><td>Action</td><td>Within tolerance / corrected / reported for adjustment</td></tr></tbody></table><h3>Exposure checks</h3><ul><li>Temperature sensor inside a clean, ventilated radiation screen, 1.25 to 2 m above natural ground.</li><li>Rain gauge level, funnel and filter clear, no nearby obstruction.</li></ul><h3>Always</h3><ul><li>Take several paired readings, never just one.</li><li>Write the entry in the maintenance log the same day, with your name.</li></ul>"
  },
  "quiz": [
    {"q": "Why must field calibration use a reference instrument with its own certificate?", "options": ["It is cheaper", "So readings trace back to a known standard", "It removes the need for logs", "It replaces the station sensor"], "answer": 1,
     "explain": "Traceability means every station reading can be linked to a standard through a documented chain of comparisons."},
    {"q": "When is the best time to compare the station barometer with the reference?", "options": ["During a frontal passage", "During heavy rain", "In steady weather", "Only at night"], "answer": 2,
     "explain": "Pressure changes fast when fronts pass, which makes paired readings unreliable. Choose steady weather."},
    {"q": "A radiation screen is dirty and poorly ventilated. What error do you expect on a sunny afternoon?", "options": ["Temperature reads too warm", "Temperature reads too cold", "Pressure reads too high", "No effect"], "answer": 0,
     "explain": "A blocked screen traps heat, so the sensor reads warmer than the true air temperature."},
    {"q": "How do you check a tipping bucket gauge?", "options": ["Tap it and listen", "Pour a known volume slowly and count the tips", "Compare it with radar rainfall", "Replace it every monsoon"], "answer": 1,
     "explain": "A known volume should produce a known number of tips. Compare the count with the expected value."},
    {"q": "Which of these must a maintenance log entry include?", "options": ["Only the date", "What was done, when, by whom, and before-and-after readings", "Only parts replaced", "The weather forecast"], "answer": 1,
     "explain": "Complete entries let data users decide whether to trust or flag a reading."}
  ],
  "practical": {
    "title": "Practical task: calibrate one sensor and log it",
    "task": "Carry out a calibration check on one surface sensor at your station (barometer, temperature, humidity or rain gauge) against a reference, and complete a maintenance log entry for it.",
    "steps": ["Take at least three paired readings between the station sensor and the reference.", "Work out the difference and state whether it is within the SOP tolerance.", "Write the full maintenance log entry: what, when, who, before-and-after readings, and action taken."],
    "evidence": "Upload a photo of your record sheet or log entry, and type your readings and conclusion."
  }
},
"SAT-101": {
  "video_title": "INSAT-3D/3DR imagery interpretation",
  "chapters": [
    {"title": "INSAT-3D and 3DR at a glance",
     "points": ["Geostationary satellites over the Indian Ocean region", "Imager and sounder instruments", "Frequent images through day and night"],
     "keywords": ["insat", "3d", "3dr", "satellite", "geostationary", "imager", "sounder", "introduction", "overview"],
     "text": "INSAT-3D and INSAT-3DR are Indian geostationary meteorological satellites. Because they stay fixed over the equator, they watch the same region continuously, including the whole Indian subcontinent and the surrounding seas. Each carries an imager, which produces the pictures we use most, and a sounder, which retrieves temperature and moisture profiles. Operating the two together gives frequent images through the day and night."},
    {"title": "The imager channels",
     "points": ["Visible and shortwave infrared", "Middle infrared and water vapour", "Two thermal infrared windows"],
     "keywords": ["channel", "band", "visible", "infrared", "ir", "water", "vapour", "vapor", "tir", "swir", "mir", "wavelength"],
     "text": "The imager observes in six channels: visible, shortwave infrared, middle infrared, water vapour, and two thermal infrared windows. Visible and shortwave channels see reflected sunlight. The thermal infrared channels measure the temperature of whatever the satellite sees, whether cloud top or ground. The water vapour channel senses moisture in the middle and upper atmosphere. Each channel answers a different question, and the skill is in combining them."},
    {"title": "Reading visible imagery",
     "points": ["Shows reflected sunlight, so daytime only", "Thick clouds look bright; thin clouds look grey", "Texture separates lumpy convection from smooth fog"],
     "keywords": ["visible", "vis", "reflectance", "bright", "daytime", "texture", "fog", "low", "cloud", "thick"],
     "text": "Visible imagery shows reflected sunlight, so it is available only in daytime. Thick clouds with a lot of water look bright white, and thin clouds look grey. Texture matters as much as brightness. Convective clouds look lumpy and cast shadows in the morning and evening, while fog and low stratus look smooth, with edges that follow valleys and coastlines."},
    {"title": "Reading thermal infrared imagery",
     "points": ["Shows brightness temperature, day and night", "Colder means higher cloud tops", "Very cold tops mark deep convection"],
     "keywords": ["infrared", "ir", "thermal", "brightness", "temperature", "cold", "cloud", "top", "night", "convection", "height"],
     "text": "Thermal infrared imagery shows brightness temperature and works day and night. Because the atmosphere gets colder with height, colder cloud tops are higher cloud tops. Very cold, expanding tops mark deep convection and thunderstorms. The weakness is low cloud and fog: their tops are nearly as warm as the ground, so they can almost disappear in infrared alone."},
    {"title": "Reading water vapour imagery",
     "points": ["Senses moisture in the middle and upper atmosphere", "Dark areas are dry; white areas are moist", "Reveals troughs, jet streams and dry intrusions"],
     "keywords": ["water", "vapour", "vapor", "wv", "moisture", "dry", "jet", "trough", "upper", "intrusion"],
     "text": "The water vapour channel shows moisture in the middle and upper troposphere, even where there is no cloud. Dark areas are dry, often where air is sinking, and white areas are moist. This makes the flow of the upper atmosphere visible: troughs, jet streams and dry air intruding into a weather system. A dark slot pushing into a cyclone or a monsoon trough is worth watching."},
    {"title": "Combining channels to identify cloud",
     "points": ["Bright visible plus cold infrared: deep convection", "Bright visible plus warm infrared: low cloud or fog", "Thin visible plus cold infrared: cirrus"],
     "keywords": ["combine", "combination", "identify", "cumulonimbus", "cb", "cirrus", "fog", "low", "classification", "rgb"],
     "text": "No single channel identifies cloud type reliably, so compare them. Bright in visible and very cold in infrared means thick, tall cloud, typically cumulonimbus. Bright in visible but warm in infrared means low cloud or fog. Cold in infrared but thin and grey in visible means high cirrus, which produces no rain at the surface."},
    {"title": "Indian weather systems from space",
     "points": ["Monsoon cloud bands and the monsoon trough", "Tropical cyclones: dense overcast and the eye", "Western disturbances in winter"],
     "keywords": ["monsoon", "cyclone", "eye", "western", "disturbance", "cdo", "system", "indian", "bay", "arabian"],
     "text": "Over India, a few patterns come up again and again. During the monsoon, look for organised cloud bands along the monsoon trough and offshore convection along the west coast. For tropical cyclones in the Bay of Bengal and Arabian Sea, look for the central dense overcast, curved rain bands, and, in stronger systems, a clear eye. In winter, western disturbances bring cloud bands from the west into the north of the country."}
  ],
  "reading": {
    "title": "Field reference notes: channel comparison guide",
    "html": "<h3>What each channel shows</h3><table><thead><tr><th>Channel</th><th>Shows</th><th>When</th></tr></thead><tbody><tr><td>Visible</td><td>Reflected sunlight, cloud thickness and texture</td><td>Daytime only</td></tr><tr><td>Thermal infrared</td><td>Brightness temperature, cloud-top height</td><td>Day and night</td></tr><tr><td>Water vapour</td><td>Mid and upper-level moisture</td><td>Day and night</td></tr></tbody></table><h3>Identifying cloud</h3><table><thead><tr><th>Visible</th><th>Infrared</th><th>Likely cloud</th></tr></thead><tbody><tr><td>Bright</td><td>Very cold</td><td>Deep convection (cumulonimbus)</td></tr><tr><td>Bright</td><td>Warm</td><td>Low cloud or fog</td></tr><tr><td>Thin, grey</td><td>Cold</td><td>Cirrus</td></tr></tbody></table><h3>Patterns to know</h3><ul><li>Monsoon: cloud bands along the monsoon trough.</li><li>Tropical cyclone: central dense overcast, curved bands, eye in strong systems.</li><li>Western disturbance: cloud band moving into north India in winter.</li></ul>"
  },
  "quiz": [
    {"q": "Why is visible imagery not available at night?", "options": ["The satellite switches off", "It depends on reflected sunlight", "Clouds are cold at night", "Night data is classified"], "answer": 1,
     "explain": "Visible channels measure reflected sunlight, so there is nothing to see without the sun."},
    {"q": "In thermal infrared imagery, colder cloud tops usually mean:", "options": ["Lower clouds", "Higher clouds", "Thinner clouds", "Fog"], "answer": 1,
     "explain": "Temperature falls with height, so colder tops are higher tops."},
    {"q": "A cloud is bright in visible imagery but warm in infrared. What is it most likely to be?", "options": ["Cumulonimbus", "Cirrus", "Low cloud or fog", "A cyclone eye"], "answer": 2,
     "explain": "Bright means thick; warm means low. Together they point to low cloud or fog."},
    {"q": "Dark areas in water vapour imagery indicate:", "options": ["Heavy rain", "Dry air in the middle and upper atmosphere", "Snow cover", "Sensor failure"], "answer": 1,
     "explain": "Dark shading in the water vapour channel shows dry air, often where it is sinking."},
    {"q": "Which feature marks a strong tropical cyclone?", "options": ["A clear eye inside dense overcast", "Smooth grey cloud", "A dark water vapour slot only", "Scattered cirrus"], "answer": 0,
     "explain": "Strong cyclones often show a clear eye within the central dense overcast."}
  ],
  "practical": None
}
}
