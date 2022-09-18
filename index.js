const moment = require('moment');
const axios = require('axios');
const https = require("https");

axios.defaults.timeout = 30000;
axios.defaults.httpsAgent = new https.Agent({ keepAlive: true });
const qs = require('qs');
// require a slovenian moment locale
require('moment/locale/sl');
// load the environment variables
require('dotenv').config();
// set moment locale to slovenian
moment().locale('sl');

// // // // // // // // // // // // // // // 

const hostName = process.env.HOST_NAME

const dayOffset = {
    h: 4,
    m: 0,
    s: 0,
    ms: 0
};

const descriptionLength = 3000;

let url_string_params = {
    start: '2022-06-14T00:00:00%2B02:00',
    end: '2022-06-14T23:59:59%2B02:00',
    limit: '-1'
}

const emojiRegex = /[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2580-\u27BF]|\uD83E[\uDD10-\uDDFF]/g;


const combinePathAndUrl = function (httpPath, urlParams) {
    return httpPath + '?' + Object.keys(urlParams).map(key => key + '=' + urlParams[key]).join('&');
}

const momentToEncodedDatetime = function (mmnt) {
    return mmnt.toISOString(true).replace('+', '%2B').replace(/[.]\d+/, '');
};

if (process.argv.length == 4) {
    url_string_params.start = process.argv[2];
    url_string_params.end = process.argv[3];
}
else {
    let start_moment = moment().subtract(1, 'days');
    let end_moment = moment();
    start_moment.set(dayOffset);
    end_moment.set(dayOffset);
    url_string_params.start = momentToEncodedDatetime(start_moment);
    url_string_params.end = momentToEncodedDatetime(end_moment);
}

console.log(url_string_params);


const automation_metadata_param = process.env.AUTOMATION_METADATA
const auth_token_param = process.env.AUTH_TOKEN

const api_window_watcher_url = process.env.API_WINDOW_WATCHER_URL
const api_afk_watcher_url = process.env.API_AFK_WATCHER_URL

const programs_regex_values = {
    ark: /ARK: Survival Evolved/,
    rocketLeague: /Rocket League/
}

const games_values = {
    ark: "ARK: Survival Evolved",
    rocketLeague: "Rocket League",
    swtor: "Star Wars: The Old Republic"
}

const browser_regex_values = {
    youtube: /YouTube/,
    twitch: /Twitch/,
    plex: /Plex/,
    jellyfin: /Jellyfin Media Player/,
    vlc: /VLC/,
    gmail: /Gmail/,
    zohomail: /Zoho Mail/,
    wikipedia: /Wikipedia/,
    tor: /Tor Browser/,
    stackoverflow: /Stack Overflow/,
}

const getSiteData = function (site) {
    if (site.match(browser_regex_values.youtube)) {
        site = 'YouTube';
    } else if (site.match(browser_regex_values.twitch)) {
        site = 'Twitch';
    } else if (site.match(browser_regex_values.plex)) {
        site = 'Plex';
    } else if (site.match(browser_regex_values.jellyfin)) {
        site = 'Jellyfin';
    } else if (site.match(browser_regex_values.vlc)) {
        site = 'VLC';
    } else if (site.match(browser_regex_values.gmail)) {
        site = 'Gmail';
    } else if (site.match(browser_regex_values.zohomail)) {
        site = 'Zoho Mail';
    } else if (site.match(browser_regex_values.wikipedia)) {
        site = 'Wikipedia';
    } else if (site.match(browser_regex_values.tor)) {
        site = 'Tor Browser';
    } else if (site.match(browser_regex_values.stackoverflow)) {
        site = 'Stack Overflow';
    } else {
        site = null;
    }
    return site;
}

const getMergedResponse = function (response) {
    let active_app = response[0].data.app;
    let active_app_title = response[0].data.title;
    let active_start_time = moment(response[0].timestamp);
    let active_end_time = moment(response[0].timestamp).add(response[0].duration, 'seconds');
    let merged_response = [];

    response.shift();

    response.forEach(function (item) {
        const start_time = moment(item.timestamp)
        const end_time = moment(item.timestamp).add(item.duration, 'seconds')
        const app_name = item.data.app;
        const app_title = item.data.title;

        if (app_name == active_app && start_time < active_end_time.add(3, 'minutes')) {
            active_end_time = end_time;
            active_app_title += '\n' + app_title;
        }
        else {
            const act_duration = active_end_time.diff(active_start_time, 'seconds');

            if (act_duration > 4) {
                merged_response.push({
                    app: active_app,
                    title: active_app_title,
                    start: active_start_time,
                    end: active_end_time,
                    duration: act_duration
                });
            }
            active_app = app_name;
            active_app_title = app_title;
            active_start_time = start_time;
            active_end_time = end_time;
        }
    });
    const act_duration = active_end_time.diff(active_start_time, 'seconds');

    if (act_duration > 4) {
        merged_response.push({
            app: active_app,
            title: active_app_title,
            start: active_start_time,
            end: active_end_time,
            duration: act_duration
        });
    }

    return merged_response;
}

const getMergedObject = function (response) {
    let active_app = response[0].app;
    let active_app_title = response[0].title;
    let active_start_time = response[0].start;
    let active_end_time = response[0].end;
    let merged_response = [];

    response.shift();

    response.forEach(function (item) {
        const start_time = item.start;
        const end_time = item.end;
        const app_name = item.app;
        const app_title = item.title;

        if (app_name == active_app && start_time < active_end_time.add(3, 'minutes')) {
            active_end_time = end_time;
            active_app_title += '\n' + app_title;
        }
        else {
            merged_response.push({
                app: active_app,
                title: active_app_title,
                start: active_start_time,
                end: active_end_time,
                duration: active_end_time.diff(active_start_time, 'seconds')
            });
            active_app = app_name;
            active_app_title = app_title;
            active_start_time = start_time;
            active_end_time = end_time;
        }
    });

    merged_response.push({
        app: active_app,
        title: active_app_title,
        start: active_start_time,
        end: active_end_time,
        duration: active_end_time.diff(active_start_time, 'seconds')
    });

    return merged_response;
}

const getBrowserSpecific = function (response) {
    let active_app = null;
    let active_app_title = null;
    let active_app_site = null;
    let active_start_time = null;
    let active_end_time = null;
    let merged_response = [];

    response.forEach(function (item) {
        const app_name = item.data.app;
        let push_needed = false;

        if (['chrome.exe', 'firefox.exe', 'msedge.exe'].includes(app_name)) {
            const site_name = getSiteData(item.data.title);
            if (site_name) {
                if (active_app == null) {
                    active_app = item.data.app;
                    active_app_title = item.data.title;
                    active_app_site = site_name;
                    active_start_time = moment(item.timestamp);
                    active_end_time = moment(item.timestamp).add(item.duration, 'seconds');
                }
                else if (active_app == site_name) {
                    active_end_time = moment(item.timestamp).add(item.duration, 'seconds');
                }
                else {
                    push_needed = true;
                }
            }
            else if (active_app != null) {
                push_needed = true;
            }
        }
        else if (active_app != null) {
            push_needed = true;
        }

        if (push_needed) {
            merged_response.push({
                app: active_app,
                title: active_app_title,
                site: active_app_site,
                start: active_start_time,
                end: active_end_time,
                duration: active_end_time.diff(active_start_time, 'seconds')
            });
            active_app = null;
            active_app_title = null;
            active_start_time = null;
            active_end_time = null;
        }
    });

    return merged_response;
}

const getMergedBrowserObject = function (response) {
    let active_app = response[0].app;
    let active_app_title = response[0].title;
    let active_app_site = response[0].site;
    let active_start_time = response[0].start;
    let active_end_time = response[0].end;
    let merged_response = [];

    response.shift();

    response.forEach(function (item) {
        const start_time = item.start;
        const end_time = item.end;
        const app_name = item.app;
        const app_title = item.title;
        const app_site = item.site;

        if ((app_name == active_app && app_site == active_app_site) && start_time < active_end_time.add(1, 'minutes')) {
            active_end_time = end_time;
            active_app_title += '\n' + app_title;
        }
        else {
            const act_duration = active_end_time.diff(active_start_time, 'seconds');

            if (act_duration > 59) {
                merged_response.push({
                    app: active_app,
                    title: active_app_title,
                    site: active_app_site,
                    start: active_start_time,
                    end: active_end_time,
                    duration: act_duration
                });
            }
            active_app = app_name;
            active_app_title = app_title;
            active_app_site = app_site;
            active_start_time = start_time;
            active_end_time = end_time;
        }
    });
    const act_duration = active_end_time.diff(active_start_time, 'seconds');

    if (act_duration > 59) {
        merged_response.push({
            app: active_app,
            title: active_app_title,
            site: active_app_site,
            start: active_start_time,
            end: active_end_time,
            duration: active_end_time.diff(active_start_time, 'seconds')
        });
    }

    return merged_response;
}

const getMergedAFK = function (response) {
    merged_response_afk = [];
    merged_response_not_afk = [];
    response.forEach(function (item) {
        const item_start = moment(item.timestamp);
        const item_end = moment(item.timestamp).add(item.duration, 'seconds');
        const status = item.data.status;

        if (status == 'not-afk') {
            merged_response_not_afk.push({
                start: item_start,
                end: item_end,
                duration: item.duration,
                status: status
            })
        }
        else if (status == 'afk') {
            merged_response_afk.push({
                start: item_start,
                end: item_end,
                duration: item.duration,
                status: status
            })
        }
    });

    return [merged_response_afk, merged_response_not_afk];
}

const checkNonAFKBorderingElements = function (item, not_afk_sessions) {
    let start_item = null;
    let end_item = null;
    let item_start = parseInt(item.start / 1000);
    let item_end = parseInt(item.end / 1000);
    not_afk_sessions.forEach(function (not_afk_item) {
        let not_afk_item_start = parseInt(not_afk_item.start / 1000);
        let not_afk_item_end = parseInt(not_afk_item.end / 1000);
        if (item_start - not_afk_item_end >= -5 && item_start - not_afk_item_end < 5) {
            start_item = not_afk_item;
        }
        if (item_end - not_afk_item_start >= -5 && item_end - not_afk_item_start < 5) {
            end_item = not_afk_item;
        }
    });
    if (start_item && end_item) {
        return [start_item, end_item];
    }
    return null;
}

const window_call = combinePathAndUrl(api_window_watcher_url, url_string_params);
const afk_call = combinePathAndUrl(api_afk_watcher_url, url_string_params);

const window_options = {
    url: window_call,
    method: 'GET'
}

const afk_options = {
    url: afk_call,
    method: 'GET'
}

async function main() {

    const window_res = await axios(window_options).catch(err => {
        console.log("AXIOS: WINDOW_WATCHER_ERROR")
        //console.log(err)
    });

    const afk_res = await axios(afk_options).catch(err => {
        console.log("AXIOS: AFK_WATCHER_ERROR")
        //console.log(err)
    });

    //response = require('./response.json');
    response = window_res.data;

    //response_afk = require('./response_afk.json');
    response_afk = afk_res.data;

    response.sort(function (a, b) {
        return moment(a.timestamp) - moment(b.timestamp);
    });

    response_afk.sort(function (a, b) {
        return moment(a.timestamp) - moment(b.timestamp);
    });

    response_afk = Object.values(response_afk.reduce((r, o) => {
        r[o.timestamp] = (r[o.timestamp] && r[o.timestamp].duration > o.duration) ? r[o.timestamp] : o

        return r
    }, {}));

    /*     ORIGINAL
    {
      id: 2,
      timestamp: '2022-06-14T11:32:26.478000+00:00',
      duration: 9.234,
      data: {
        app: 'chrome.exe',
        title: 'ActivityWatch - Open-source time tracker - Google Chrome'
      }
    }
    */
    /*     MERGED
    {
      app: 'chrome.exe',
      title: 'ActivityWatch - Open-source time tracker - Google Chrome',
      start: Moment<2022-06-14T13:32:26+02:00>,
      end: Moment<2022-06-14T13:32:35+02:00>,
      duration: 9
    }
    */

    // browser specific check the website with regex in addition to the app name
    // if the website is found in the regex and the app name is one of the browsers, then the app is browser specific
    // and is counted as a separate app inside browser_specific array

    let app_sessions = getMergedObject(getMergedResponse(response));  // program sessions

    let browser_specific = getBrowserSpecific(response);

    browser_specific = browser_specific.filter(el => el.duration > 10);

    let browser_specific_sessions = getMergedBrowserObject(browser_specific); // browser specific sessions


    /*     ORIGINAL
    {
        "id": 1,
        "timestamp": "2022-06-14T11:32:24.410000+00:00",
        "duration": 330.939,
        "data": {
            "status": "not-afk"
        }
    }
    */
    /*     MERGED
    {
        start: Moment<2022-06-14T21:08:16+02:00>,
        end: Moment<2022-06-14T21:11:25+02:00>,
        duration: 189.103,
        status: 'afk'
    }
    */

    const merged_afk = getMergedAFK(response_afk);
    let afk_sessions = merged_afk[0];
    let not_afk_sessions = merged_afk[1];

    /*console.log('|||||||||||||||||||||||||');
    console.log('AFK SESSIONS');
    console.dir(afk_sessions, {'maxArrayLength': null});
    console.log('NOT-AFK SESSIONS');
    console.dir(not_afk_sessions, {'maxArrayLength': null});
    console.log('|||||||||||||||||||||||||');*/

    let new_afk_sessions = [];

    // cutting AFK time from window events
    afk_sessions.forEach(function (item) {
        const non_afk_elements = checkNonAFKBorderingElements(item, not_afk_sessions);
        if (item.duration < 240) {
            // if we can find the item.start in the end of not_afk_sessions and item.end in the start of not_afk_sessions then we can replace the afk session with not-afk session
            if (non_afk_elements) {
                const start_item = non_afk_elements[0];
                const end_item = non_afk_elements[1];
                const new_not_afk_item = {
                    start: start_item.start,
                    end: end_item.end,
                    duration: end_item.end.diff(start_item.start, 'seconds'),
                    status: 'not-afk'
                };
                // filter out the start_item and end_item
                not_afk_sessions = not_afk_sessions.filter(el => !((el.start == start_item.start && el.end == start_item.end) || (el.start == end_item.start && el.end == end_item.end)));
                // add the new not-afk session
                not_afk_sessions.push(new_not_afk_item);
            }
            else {
                const new_not_afk_item = {
                    start: item.start,
                    end: item.end,
                    duration: item.end.diff(item.start, 'seconds'),
                    status: 'not-afk'
                };
                not_afk_sessions.push(new_not_afk_item);
            }
        }
        else if (item.duration < 1800) {
            // if the app is chrome.exe or vlc.exe or plex.exe between the time of the item.start and item.end, then we take away the afk time

            // is the 'item' time between the start and end of one of the activities
            // check Plex.exe or VLC.exe or JellyfinMediaPlayer.exe
            let no_cut = false;
            app_sessions.forEach(function (merged_item) {
                if (merged_item.app == 'JellyfinMediaPlayer.exe' || merged_item.app == 'Plex.exe' || merged_item.app == 'vlc.exe') {
                    if (item.start >= merged_item.start && item.end <= merged_item.end) {
                        //console.log("Don't cut - " + item.start.format('YYYY-MM-DD HH:mm:ss') + " - " + item.end.format('YYYY-MM-DD HH:mm:ss') + " - " + merged_item.app);
                        no_cut = true;
                    }
                }
            });
            // check browser specific
            browser_specific_sessions.forEach(function (browser_specific_item) {
                if (browser_specific_item.site == 'YouTube' || browser_specific_item.site == 'Twitch') {
                    if (item.start >= browser_specific_item.start && item.end <= browser_specific_item.end) {
                        //console.log("Don't cut - " + item.start.format('YYYY-MM-DD HH:mm:ss') + " - " + item.end.format('YYYY-MM-DD HH:mm:ss') + " - " + browser_specific_item.site);
                        no_cut = true;
                    }
                }
            });

            if (no_cut) {
                //console.log("NO CUT " + item.start.format('YYYY-MM-DD HH:mm:ss') + " - " + item.end.format('YYYY-MM-DD HH:mm:ss'));
                /*if (non_afk_elements) {
                    console.log("non_afk_elements")
                    const start_item = non_afk_elements[0];
                    const end_item = non_afk_elements[1];
                    const new_not_afk_item = {
                        start: start_item.start,
                        end: end_item.end,
                        duration: end_item.end.diff(start_item.start, 'seconds'),
                        status: 'not-afk'
                    };
                    // filter out the start_item and end_item
                    not_afk_sessions = not_afk_sessions.filter(el => !((el.start == start_item.start && el.end == start_item.end) || (el.start == end_item.start && el.end == end_item.end)));
                    console.log(new_not_afk_item)
                    console.log("LENGTHS")
                    // add the new not-afk session
                    console.log(not_afk_sessions.length)
                    not_afk_sessions.push(new_not_afk_item);
                    console.log(not_afk_sessions.length)
                }
                else {*/
                    //console.log("NO non_afk_elements")
                    const new_not_afk_item = {
                        start: item.start,
                        end: item.end,
                        duration: item.end.diff(item.start, 'seconds'),
                        status: 'not-afk'
                    };
                    //console.log(new_not_afk_item)
                    // add the new not-afk session
                    not_afk_sessions.push(new_not_afk_item);
                //}
            }
            else {
                new_afk_sessions.push(item);
            }
        }
        else if (item.duration < 10000) {
            app_sessions.forEach(function (merged_item) {
                if (merged_item.app == 'JellyfinMediaPlayer.exe' || merged_item.app == 'Plex.exe' || merged_item.app == 'vlc.exe') {
                    if (item.start >= merged_item.start && item.end <= merged_item.end) {
                        //console.log("Don't cut - " + item.start.format('YYYY-MM-DD HH:mm:ss') + " - " + item.end.format('YYYY-MM-DD HH:mm:ss') + " - " + merged_item.app);
                        /*if (non_afk_elements) {
                            const start_item = non_afk_elements[0];
                            const end_item = non_afk_elements[1];
                            const new_not_afk_item = {
                                start: start_item.start,
                                end: end_item.end,
                                duration: end_item.end.diff(start_item.start, 'seconds'),
                                status: 'not-afk'
                            };
                            // filter out the start_item and end_item
                            not_afk_sessions = not_afk_sessions.filter(el => !((el.start == start_item.start && el.end == start_item.end) || (el.start == end_item.start && el.end == end_item.end)));
                            // add the new not-afk session
                            not_afk_sessions.push(new_not_afk_item);
                        }
                        else {*/
                            const new_not_afk_item = {
                                start: item.start,
                                end: item.end,
                                duration: item.end.diff(item.start, 'seconds'),
                                status: 'not-afk'
                            };
                            // add the new not-afk session
                            not_afk_sessions.push(new_not_afk_item);
                        //}
                    }
                    else {
                        new_afk_sessions.push(item);
                    }
                }
                else {
                    new_afk_sessions.push(item);
                }
            });
        }
        else {
            new_afk_sessions.push(item);
        }
    })

    //console.log(not_afk_sessions.length)

    not_afk_sessions.sort(function (a, b) {
        return moment(a.start) - moment(b.start);
    });

    //console.log(not_afk_sessions.length)

    //console.log("...\n...\n\n\nNOT AFK SESSIONS ...........")
    //console.dir(not_afk_sessions, {'maxArrayLength': null})

    let final_not_afk_sessions = [];

    if (not_afk_sessions.length < 1) {
        console.log("No not-afk sessions");
        process.exit(0);
    }
    else {
        let active_nafk_start = not_afk_sessions[0].start;
        let active_nafk_end = not_afk_sessions[0].end;

        not_afk_sessions.shift();

        not_afk_sessions.forEach(function (item) {
            if (item.start > active_nafk_end.add(5, 'seconds')) {
                final_not_afk_sessions.push({
                    start: active_nafk_start,
                    end: active_nafk_end,
                    duration: active_nafk_end.diff(active_nafk_start, 'seconds'),
                    status: 'not-afk'
                });
                active_nafk_start = item.start;
                active_nafk_end = item.end;
            }
            else {
                active_nafk_end = item.end;
            }
        });
        final_not_afk_sessions.push({
            start: active_nafk_start,
            end: active_nafk_end,
            duration: active_nafk_end.diff(active_nafk_start, 'seconds'),
            status: 'not-afk'
        });
    }

    //console.log("...\n...\n\n\nFINAL NOT AFK SESSIONS ...........")
    //console.dir(final_not_afk_sessions, {'maxArrayLength': null})

    let final_app_activities = [];
    let final_browser_activities = [];

    let not_afk_index = 0;
    let app_index = 0;
    let browser_index = 0;

    for (not_afk_index = 0; not_afk_index < final_not_afk_sessions.length; not_afk_index++) {
        const not_afk_item = final_not_afk_sessions[not_afk_index];

        for (app_index = 0; app_index < app_sessions.length; app_index++) {
            const app_item = app_sessions[app_index];

            if (app_item.start < not_afk_item.end && app_item.end > not_afk_item.start) {
                // if the item is the same or completely inside the not-afk session 
                if (app_item.start >= not_afk_item.start && app_item.end <= not_afk_item.end) {
                    final_app_activities.push(app_item);
                }
                // if the item has the start before the not-afk session and the end inside the not-afk session
                else if (app_item.start < not_afk_item.start && app_item.end > not_afk_item.start && app_item.end < not_afk_item.end) {
                    final_app_activities.push({
                        app: app_item.app,
                        title: app_item.title,
                        start: not_afk_item.start,
                        end: app_item.end,
                        duration: app_item.end.diff(not_afk_item.start, 'seconds')
                    });
                }
                // if the item has the start inside the not-afk session and the end outside the not-afk session
                else if (app_item.start > not_afk_item.start && app_item.end > not_afk_item.end) {
                    final_app_activities.push({
                        app: app_item.app,
                        title: app_item.title,
                        start: app_item.start,
                        end: not_afk_item.end,
                        duration: not_afk_item.end.diff(app_item.start, 'seconds')
                    });
                }
                // if the item has both the start and the end outside the not-afk session but goes through the not-afk session
                else if (app_item.start < not_afk_item.start && app_item.end > not_afk_item.end) {
                    final_app_activities.push({
                        app: app_item.app,
                        title: app_item.title,
                        start: not_afk_item.start,
                        end: not_afk_item.end,
                        duration: not_afk_item.end.diff(app_item.start, 'seconds')
                    });
                }
            }
        }

        // BROWSER SPECIFIC

        for (browser_index = 0; browser_index < browser_specific_sessions.length; browser_index++) {
            const browser_item = browser_specific_sessions[browser_index];

            if (browser_item.start < not_afk_item.end && browser_item.end > not_afk_item.start) {
                // if the item is the same or completely inside the not-afk session 
                if (browser_item.start >= not_afk_item.start && browser_item.end <= not_afk_item.end) {
                    final_browser_activities.push(browser_item);
                }
                // if the item has the start before the not-afk session and the end inside the not-afk session
                else if (browser_item.start < not_afk_item.start && browser_item.end > not_afk_item.start && browser_item.end < not_afk_item.end) {
                    final_browser_activities.push({
                        app: browser_item.app,
                        title: browser_item.title,
                        site: browser_item.site,
                        start: not_afk_item.start,
                        end: browser_item.end,
                        duration: browser_item.end.diff(not_afk_item.start, 'seconds')
                    });
                }
                // if the item has the start inside the not-afk session and the end outside the not-afk session
                else if (browser_item.start > not_afk_item.start && browser_item.end > not_afk_item.end) {
                    final_browser_activities.push({
                        app: browser_item.app,
                        title: browser_item.title,
                        site: browser_item.site,
                        start: browser_item.start,
                        end: not_afk_item.end,
                        duration: not_afk_item.end.diff(browser_item.start, 'seconds')
                    });
                }
                // if the item has both the start and the end outside the not-afk session but goes through the not-afk session
                else if (browser_item.start < not_afk_item.start && browser_item.end > not_afk_item.end) {
                    final_browser_activities.push({
                        app: browser_item.app,
                        title: browser_item.title,
                        site: browser_item.site,
                        start: not_afk_item.start,
                        end: not_afk_item.end,
                        duration: not_afk_item.end.diff(browser_item.start, 'seconds')
                    });
                }
            }
        }
    }

    
    //console.log("FINAL APP ACTIVITIES")
    //console.dir(final_app_activities, {'maxArrayLength': null});
    //console.log("FINAL BROWSER ACTIVITIES")
    //console.dir(final_browser_activities, {'maxArrayLength': null});


    // INSERT THE LOGS

    const default_log_options = {
        url: hostName + '/api/v1/log',
        method: 'POST',
        timeout: 120000,
        headers: {
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Content-Type': 'application/json'
        }
    }

    let i = 0;

    for(const activity of final_app_activities) {
        //console.log(final_app_activities)
        const activity_options = {
            url: hostName + '/api/v1/log/',
            method: 'POST',
            timeout: 120000,
            headers: {
                'Accept': '*/*',
                'Connection': 'keep-alive',
                'Content-Type': 'application/json'
            },
            data: {
                name: activity.app,
                description: Buffer.from(activity.title, 'utf-8').toString().replace(emojiRegex, '').substring(0, descriptionLength),
                category: 'Logging:Precise:Computer:Windows:Application',
                type: 30,
                start: activity.start.format("YYYY-MM-DD HH:mm:ss"),
                end: activity.end.format("YYYY-MM-DD HH:mm:ss"),
                metadata_token: automation_metadata_param,
                auth_token: auth_token_param
            }
        }
        if (activity.app == 'RocketLeague.exe') {
            let act_options = activity_options
            act_options.data.name = games_values.rocketLeague
            act_options.data.category = 'Entertainment:Games'
            const insert_log_response = await axios(act_options).catch((err) => console.log(err));
            i++
        }
        else if (activity.app == 'ShooterGame.exe') {
            let act_options = activity_options
            act_options.data.name = games_values.ark
            act_options.data.category = 'Entertainment:Games'
            const insert_log_response = await axios(act_options).catch((err) => console.log(err));
            i++
        }
        else if (activity.app == 'swtor.exe') {
            let act_options = activity_options
            act_options.data.name = games_values.swtor
            act_options.data.category = 'Entertainment:Games'
            const insert_log_response = await axios(act_options).catch((err) => console.log(err));
            i++
        }
        /*if (activity.app == 'vlc.exe') {
            console.log(activity)
        }*/
        const insert_log_response = await axios(activity_options).catch((err) => console.log(err));
    }

    for (activity of final_browser_activities) {
        //console.log(final_browser_activities)
        let activity_options = default_log_options
        activity_options.data = {
            name: activity.site,
            description: Buffer.from(activity.app + '\n' + activity.title, 'utf-8').toString().replace(emojiRegex, '').substring(0, descriptionLength),
            category: 'Logging:Precise:Computer:Website',
            type: 30,
            start: activity.start.format("YYYY-MM-DD HH:mm:ss"),
            end: activity.end.format("YYYY-MM-DD HH:mm:ss"),
            metadata_token: automation_metadata_param,
            auth_token: auth_token_param
        }
        if (activity.site == 'YouTube' || activity.site == 'Twitch') {
            let act_options = activity_options
            act_options.data.category = 'Entertainment:Web'
            const insert_log_response = await axios(act_options).catch((err) => console.log(err));
            i++
        }
        const insert_log_response = await axios(activity_options).catch((err) => console.log(err));
    }

    console.log(final_browser_activities.length);
    console.log(final_app_activities.length);
    console.log(i)
}

main();
