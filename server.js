require("dotenv").config();
const express = require("express");
const axios = require("axios");
const Anthropic = require("@anthropic-ai/sdk");
const { Redis } = require("@upstash/redis");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const {
    PAGE_ACCESS_TOKEN,
    VERIFY_TOKEN,
    IG_BUSINESS_ACCOUNT_ID,
    ANTHROPIC_API_KEY,
    UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN,
    TELEGRAM_BOT_TOKEN,
    RENDER_EXTERNAL_URL,
    ADMIN_ACCESS_KEY,
    ADMIN_TELEGRAM_CHAT_ID,
    GOOGLE_SHEETS_WEBHOOK_URL,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_VERIFY_TOKEN,
    PORT = 3000,
} = process.env;

const WHATSAPP_NUMBER_DISPLAY = "+90 533 556 62 10";
const WHATSAPP_NUMBER_DIGITS = "905335566210";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER_DIGITS}`;
const WHATSAPP_BUTTON_MARKER = "[[WHATSAPP_BUTTON]]";
const WHATSAPP_CLOUD_API_VERSION = "v21.0";
const HUMAN_HANDOFF_MARKER = "[[HUMAN_HANDOFF]]";
const PUBLIC_URL = RENDER_EXTERNAL_URL || "https://wintek-instagram-webhook.onrender.com";
const BAYILIK_FORM_URL = `${PUBLIC_URL}/bayilik`;
const BAYILIK_APPLICATIONS_KEY = "bayilik:basvurular";
const BAYILIK_APPLICATIONS_MAX = 500; // listenin sinirsiz buyumesini onlemek icin
const WINTEK_LOGO_DATA_URI = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAAAAAAD/2wBDAAQDAwQDAwQEAwQFBAQFBgoHBgYGBg0JCggKDw0QEA8NDw4RExgUERIXEg4PFRwVFxkZGxsbEBQdHx0aHxgaGxr/2wBDAQQFBQYFBgwHBwwaEQ8RGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhr/wAARCADtAbgDASIAAhEBAxEB/8QAHQAAAgEFAQEAAAAAAAAAAAAAAAEIAgUGBwkDBP/EAEwQAAECBAQDBgIGBQkIAgIDAAECEQADBCEFBhIxB0FRCBMiYXGBMpEUI0KhsfAVM1LB0RYXGENTYnLh8SQlNGOCkpOiJ1REsmVzg//EABwBAQACAgMBAAAAAAAAAAAAAAABAgUGAwQHCP/EADcRAAIBAwIEAwQJAwUAAAAAAAABAgMEEQUxBiFBURJhkRMygcEVIiNCcaGx0fAHcuEUFlKC8f/aAAwDAQACEQMRAD8AnjcXsYTj0gFhD/D1gBAv0hgwnY2hDmCCIAqbpv6whts3nDYeY9oLQAww3inw+Q9ob+f3GAk6S+/rABbd4p9x7Qw4hE+RgCO3a2ztX5dy5l/CcHrJ1JU4pWLmTjJmFBVJlJukkMWK1pcc9MRKXnnMBIQrFqmxZlTphPz1XjcPa9xZOIcScLw4KJTh2EJKgOSpsxSj76Up+UaBBZLMSH31OPb/ACjVb6rJ3EknsfQHCen0I6RSlOCbll815/sX4Z1x9KT/ALwqNTBT94sWZ/2vKPZGfcxocy8TqlB7vOXb/wBvaMa06SACEqsbj8/xioFZUlGjUpnZrv8AkR0faT7m2f6O229mvRE9+zNmqdmXh8pFZVTKqooqooebMK1BC0JWkOSSwJWA55Nyjcu5Nw8RA7HWPmnx3GcEmFKUVdGJstKS6dUpf4lM0/KJgDzvG2WVT2lCLZ888TWis9WrQisJvK+Kz+uRgnm0FoBbyhX57x3DWSpw1hCg5QDzgAB5bw35QcoRDc4AYLbA+sA9fuhh2ilwYAYY+sOzPv7Qm6XguIAbdGEAaAHycQXL9IAQ+6GHMJ/eKg14AOrwfKFcQwWs8AD28oAekA6BoBZ2YQAbwmHT74Yv5wNAA++0Ic+sN/WD74ANR6Qb72g9IYDbwAWaAOzBmgcQdYAAW3EDiAWtyhPfcwAwObQnb+MAJg2gBgw+rB4pg36GAKm/IhX6gwCG8AUv6wx5vA7WgB3cGAG8EIHyg1eUAOCFBAHz+oP4w3LXDQDaEH9oAb+e8IX5ke8MbM8WLN2bcIyPgVTjWZawUdDT2JZ1TFH4UITupR5AfcATENpLLLwhKpJQgst7I9cy5lwvKOC1eM5hq0UVBSp1TJqzz5JA+0omwAuTGl+HvajwrN+YKnD8aok4JTzJumimzJwUUh2HfXYav2k+FJLHkoxk4vcYcW4p40qZVKNHg9OsiioQt0yhtrU3xTCN1cgWFt9dy5yqdSZ0lSpcxB1JUD8Po3X98YGtqUvafZ7L8z1/TOB6Ts5O9f2ktsfd/d9+nTzOr6SSLlhA3WIc8EO0dNwf6NgebZsypw0Du5czSVzJJt8DfEjd5e4+ySPCJN5g4l5Uy1g0jFsWxulRR1CddMZa+9XUBn+rQl1K9hbm0Zalc060PEmed6jod7p1x7CcG87NLOfw/YysAdTHjPnIkSVzJyky5aQ6lrISkepNhESs/wDa8rJiptLkKgl0MpmFZWgTJx8xLB0I9yv0iP8AmPiBmPN84zcfxSpxFaT4e+mmZpvySrwj2Ajp1dSpQeI8zYdP4J1C7SnXapp9+b9F82X/AI64zKx3i9misp5yJ9Ompl08ibLXqStEuUhPhIsQ784134SSD4SbNs/l6xUqaqYomb41c3G/8IQWpi60qFnUEgP/AIo12pJ1Jub6ntllbRsranbxeVFJeg0qUASNJFiPMe353hKWiyUjxB/tE/hCOoo8ZLMSCTYQ++dBdIZmYGOI7hsngTmUZY4j4FVrUJdMqpTJqVqWAEy5gMtRVyZlg+Wl46I01TKqpIm0s2XPlHZctYWk+4tHKumqZkupQuRMEqa/hWg6SHHlbqOb/jkmXOIWN5YqkVGE186knM2qUTLLeZQz+7jyjK2d6rePhkso0HiPheWtVVcUqijJLGGt+b69NzpsDYwA+cQ8yZ2t8TpiiVmymk4hJFjNIEmZ/wB6QUk+qA/WJIZM4p5azzJScHr0y6oo1mkqClE1uZTcpWPNJIHNoztG6pVvdfM8l1HQdQ0znWp/V7rmv5+JmfU3MaS4r9ozCshYpLwXBJUrGMYTNAq3WRJphuUFSbmYR9kfDueSTg/HLtJokS6rLvDisCpp1SqrFpB1aTsUSD1veZy2S5uIllapswqmLCVqN9TsSX5nY9X9XjH3eoeD6lLfubhw5we7pK51BNRe0dm/N9l2W7OnOSc54ZnvApOLYLMeWu02UojXJWzlKm+YOxBBEZFvvHODhdxTxPhvjMqqwyb3lKs6aiQt9K0O+lQHLzFwS4e4M/smZywzPGByMUwSdrlqAE2USNchbXQsdeh2IYixjt2l3G4jj7xrvEPD1XRqvijzpS2fbyf85mRC20G/+kKC7dfWO+akPk0H53ggb3gAdv8ASAF+TQP0/GAesAHuTDFhC3EN+ogBt6wN6xSPeB/OAHtYl4GfaFDBgAbd9ofLd4V+sANr2gBi2zQPbcAwPeC7+UAAPOCB7GB+kAEHyg2fnBvAAGg6wOxggAbpDhe3yg+6AAnygfzhuIW233wAC3NoH84OX8IPY/OABz5GGLBv3wmgEANxA49IBABACZriCKoIA+bqbiF1d7QwDyEDm9oAtmYMcpctYDiWMYiV/RMOpZlVO7tLrKEJKjpHMsNo508VeLeLcVcd+n4hN7jDpLihoUqeXIlnYv8AaWQzq57BgI6FZuw6VjGBV1BUpC5FTJVLmJbdJBBjmLjWAzMn5mxPLlWCj6JNJplmxXJJ8Pq23tGJ1JTdNOL5dT0XgapaRvpRqx+0a+q307peb7niBpBVqBBFyFff+FopIbxMVEWIt84WpJSEhZB+1YEQKmFSbaS2/MmNaPccg6gxJ+s5W5eUfVNrqqehqmYuY4DlO6hyfrt+Lx8iXSklCWSrYi4f8jaEoKJJCAne5G3vEkcn0PVJ1oT4n07O/XlFOgghCmL3ikkzCQlfhbmqzP1Zo+KdjMhE4yaGXMxKpJYy5KHY33I5+/OLwhKo8RWTq3F5b2kHUrzUUu5chcAkA8jf7zDSkFLlkDZTuHvsY+rCeHHEDNJ1UeHDDpExm1IuPcxmuHdk/M+JDXjGJTgTchMZGnplaXvPBpF1xzp1F4pRc/yX8+Brwrlo0jUlA5E7gNf3/wAoApbqCTq5uH/H5NG3ZfYwmKR48QnqLcwI+Gt7HeJU6ScPxSchQ2vHP9FP/kYtf1Ap550Hj+7/AAayTNIbuyCg2KXCvVuY2hJOoa2dBsWFjvvF9xfgRxAy2FLpJsytQm5Ssan+cYNVVuKYJOMjMmFz6UJ+0hJY+x/jHVqafWp81zM9Y8ZaXdPwzbg/Pb1Rfg6gwKeTsTc7fwLx9NNW1NKlaJU9SNfxJt4uRcbGx6Ra6GtkVcoLppyZstreLn0I5G3OPtEwC6iGDuAWIP56Rj2nF4ZucZ060cxeU/iiszZiQVXKhZzzDN8m9o81F0Fxpa7pAGp/Te/74Yl+J0s9jq3BHpzEMp1ajr8Q2I8Lj87+kQcpTLmJD6gs9LEv0v5dYz7hZxXxLhhjSKikmk0ZT9dTqWTLmo3KSenRV9JuLEg4CNaWBuk7ElwW5RtjgBwqVxQzaJ+JyVKyzg81M2u1Dw1E2xRIF9iwUryt9qOe3jUlVSp7mG1qtaULCpK7WYY279kvMnzgWLS8ewTDsUpJc2VJr6aXUIlzk6ZiUrSFAKHIsY+/p09IplICUgBrDYBmipm843Jbcz5klht42G0DNAD5t6iFElRja9/aGBCHq0G2+0AMHoxgvB1uTBABzvBCtyhizu8AHygFoAXHJoPnADDwt9x6wQ/k0AAgAMEALCAA7Qnipw0JngBwesJusG3OAG3WE8Hr+EDeW0AMbH8YN+sIXEHuTADB82g/LQr9Xg32eAH7t7QD82hNb/OB7cx7QA/m8DW5wPyggA5XMAB3gg0+kAOCEw5/jBAHz/L2gsBByd4QP3c4A+eqlibLIbltEP8AtT8Kp2IyEZmwGSTiVC5WhNu9l80xMZabRr7izj2EZRyXiWM4+hM2TKTokyNlVE5ThEoeZO/QAnlHHUUXB+LY7Vo60biDt/fysY7nN2hr01tEiZqSxsoKDaT0PTb7o9glIVqmljux29QYomK7+onzgmXLVNmqnKEtOlIUSSWB2F/uhFJAGkkp38I2+UaXLGX4dj6loOp7KPtfews47nqhaZQIT8S9wkv+bR5VNSmmTrmlQKlAadPiUTYMBu/leEpRJlyJQXPnTVBEuUhyVqJskAbkxKrgj2aBRfR8wZ7lpn4opIVKpt0UwPIdVdTHbtbWVxLyRrmv8QUdFo96j2XzfkaW4fcBcy8RFJn4ymZheEKIPdf1ix5ncekStyH2ect5Tp5aZNChcxLOtSXJMbjw/CJFDKTLkS0oSmwAEXNKAkdI2elRhRjiKPBL7UbrUarq3E23+S/BGP0WWqSjQESZKUgDkmLkjDpSBZI+UffpHnAG5b+scxjj4voUs8vuimZh0pQuIuO+4vAG8/eALDUYFTzkELlpUD1EYFmzhLgmY6eZLraGTNCgz6I20UJLuI8lSUkEWgCAPEjsqT8KmTMRyZOmU85LkSx+EaNqZ2PYHPXTY5gtUamW41yUEBXmY6wVeFyqgEKSCOhEYzV8OsJrZpmT6GStXXRvHWq21Kt7yM5p2t32l5VvPCfR816HMFGOVCSSjBMQPT6mKzjlSlJKcExJ35SGAH3x07l8NsGQGTQSAOQ7sR6jh5g//wBKS/8AgEdX6OoGcXGurr7y9Ec3cnYLj/EDMNLguAYLWyZ9VMCVT58rTKkI+0tZ6Ddv4x0u4dZEwzh1lShwHBEESKZHjmKHinTDdcxX95Rv8hyj7sGyxQ4QsrpaeXKUQzoSBF+YC0dmhbU6GXBGF1TXb3V1GNxLkui5ANrQ0knn90AUzn98Av1PvHaMCG3L3EOxhByDuIGBgAChzDQ3HMmEB52ggBhoHgtzEHzEAP1hWLwnAhgcx+EAAt/pA/kYbC7wDaAEPSHy8vSC8K/N/SAGluUA9YB0/GDnAD+/3hbb2gZoIAH84ftC22A87QngBwONucAPpAD5QAD5mBug++B+v4QP5/fADvuYVr/vgbrA5IvcwA9toUKGPVveAG0APrAzekIW5wBUCHaCE/rC6/jAFV+sEJ/eCAPnPn98MH5coT+bekedRPlUclU6smyqeSneZNWEJHubQCWT1cB+sQY7V3ED+U+eRluinFWG5fJlzAC6V1ah9Yf+kMjyOrrEnc6cbso5WwfEqijx6gxLE6enWunpKWb35mTWOhJKHABUzkmOc9VVzq+fOqayeZ1XULVNnTDcrmKJUpRfqSTGF1GulD2cXvuencE6ROV1K8rwaUF9XKxlvqvwX6lKNAHhG55kH3+6GpfgVqdKg2rwgA+/+UUOefiI3Y7xkORMoTM9ZwwXLkph+kapMqctP2JIdU1XsgK9yIwMIuclFdT2C4rxtqMqs9opt/AkB2WODYxFEvPeZJGoLJGDyZibJRsZ3qouE+QfnEks68QMG4cU+HTMbRN0V05cqV3WgAFKNRJKlCzRkuGYbTYTh9PRYfJRT0lNKTKkykhghCQwA9ABEfO1hTKnZUw+uCdScOr5c022Sp0KLein9o3KjSjRgoI+YtSv6upXU7iq+b/JdEZeO0tk4p1hFVoYFzOkCxLP+sfeKpfaRyms6USK1aiopCUzadyWdgDMu9268ohagmakhRTpTq0hKikXtsTuG2HWx6e8iepRCVBalJIWglRJUzMblkgG7ObP7dnBjDpLQVsnEqGlrKNfeU1TJROlKZnQoAg/IiPoG5EYNwbxT9LcNMBmqYLkSVUygNnlrUgfcAW84znbfb0ihYwrP3FLBOHc2gk42J82fXJmrlIklAIRLKQSdak2daQPfpGHjtLZUUsIRTVqlEkD66n5f/6RoftM46vF+KlVSyFEpwajkUkvSr4VqBnLLdXmS7/3Y1SicJxPeJcsLnUNIG9jcctmAfk0WSIJ/wCROJ+DcQZtbKwRM9EykQiYsTTLOpKioAjSo80823EZowiHXZjxxVJxBNLPUEjEKabIAIYrWAFpJv8A8st/i3veY/KIaJPGonSqaRNnzyESpSFLWrokAkn5CNTUnaMyhWyZU2UiqSianWnvFyEHS2+kzHHpF546Y5MwHhRmiop16Z82jNJKu3inKEoX9FkxBBRSXJ0y1Bxtq1WYFre7Wt6RKWSCcB4/ZSShKgqYdTf/AJEgNzO8xrNGXZJzvhue8MqMQwVE9FPIqTTkzdPiWEglilRBbUAeYLg7Rz6l18xQSZs1I1DxGXqcJNy+x2BsCNubROzg1gqsA4YZekVCSipnUorKgEue8nEzC/oFAe0GkggzvxfwLIOL0+F4xJqplTOpRUgyjLSlKDMKN1rS51A2DxjKe0tlNQBNNWpux+tkEj5TPf0jSfahnrqeJtHKK9KJeCy+gYd/NJNwW9besadT+pSZw0KSolY0qGj363J5WLC4gkCeWSuMeA55xo4ThMqrl1PcLnvMVKUjSgpBuhZv4xy6xsEkNezRDnsuoKeJMzvAsKOF1FwxSRqluXdyduXy5y/qVaJK7cjEMI1rjfHzLWA41ieFVEqtmz8Nnqp6hSTJSnWlKVEDUsE2UOXI9I+E9pHKYGpMmsUhn1d5TsL3/rIidxKqjN4iZ0UhgtWN1AdTFiyAPP8A025xjqDOMxUuYCAQfEFBKQXtcgtu+/zs9sEE/sicU8C4gzKmVgi5iJ8hOpUuaUOpIIBI0kixKX/xCM1G8c/OHmb6vJebMOxSmP1YqGXLWoETEqspIVtd1DkPhJIifOFYnS4zhtLiGHTO9pKqUmbKV1SQ/seRHIgiKssfUQ13jWWZuOmW8p5ir8CxKXVKq6ISzOWlUpKfGgLS2tYJsoct3EbJnKKUq3Ft4gNxkrahXF/Nqu88ArJMsJKulJJ5dLfhBLIJMr7SuUEM8qru7HvZGw5/rPzfpGa5B4jYXxDpq6fgsqfKFHMQiYJqpanK06gxQpQ2845/S6h5ZBSoqDO6vPqfyX8olN2TFJOD5oCXBTVUwLp0kfVKYW36v5+US1ghG4s9Z8wzh9hVNiOOJnKk1NWiklCVpczFBRDlRAAZBu/SMA/pM5UCSVUtcgpZwZtPa7f2kY/2tKgpypl6WfElWPSnBTqBHcT3cOHsTaIsLniVLK3M1Icm4ZYFt79dzzYWexLIJljtKZSO8irBuzzacA3bczG3IhntJ5UAdNPWqD7ibTtz/wCZ5bb3iF8xPeTVJnMtLnQVISdVvn79erQIkqCVLXoAU8vwoUQEl7HoPL/MROEQTOT2mMor1ASa3UlIUQVyQw/8nmIrPaRymn+orQLX7yQNy39p1MQy79ct9R0kmyiSCSBax9Htta3OPMKmJQJjjSAwISxSk2ckG1+XTrDCBNFPaRyosgJp60gln72n3dv7SM8yNnrDs/YVPxHBpc6VJkVKqdSZxQTqCUqcaFEMyxzjnp4mdagJa7K1IADXY2Ablyu/pEvuysr/AOOKx1O2LTRuD/VSvz5M0Q1yJyZznfivgmQ8UpMOxiXUzKiqp1VCO6KEpCAvRcqULvyEY0O0dlEiyKouOU2QebH+s5Rp3tTTVfy7wYLdaDhCwQwZvpHu3r5RpE6VuUpAUgulQBNi4O17A7v5+pIgmd/SRykgrSJVWogA+GbIUCDzfvOtvWGe0flaWpAmyKxBUW/XU5APIEiY14hemqEiUCtKEy0JIlglggDkG8wN32blHnT93LBZ9Gkd4U/Couoaub7f5gxOECaf9JHKxQFJpq5QcAtMkeHff6y20H9JHKidQMitOlWl+9kMT695EMBMDS3L/snUnUTyHXc2d2t7MK7xTTVkpBAKjq1mw8T3A5li9vKGEDo9l/GZOYsEoMWokLl09dITPlpmNqCVXDsSH9DGP5/4l4Pw3kYbMx1FRMViU9cinTJCfiSgrUVKUpKUhh1uWEPhNq/mxymJiVIWMLkApVuGTsY0n2upiu4yWCFKQMRqtt3+jKiqJ6GbJ7TGU1K8NPVkktaopiSfId5f225xdMG4+5bxvGKDC6STVifXVCKeWrVJUkLUQA7LPUbPEHAgypZVMYS21AhL6SCS1gHcA+xAHSMy4UTDM4l5TUpRBGK0/wAJNxrYB7uLjcjl5ROCDoIPOD0hJuLmNT8e+JC8jZUVR4RPErHsWSuVTLG9PKA+tqD/AIQQlP8AfWnoYqWKMV7RWU8LxWsoQirqvotUumVOlrkpQtaSQrRrWCpIUClwNwWtePCT2lMqTlAfR61JLWM2n57f1kQzmazK1ElKJUtKAA7pTpsBbZj77vFJmqTJStzOShwhPxGYHYJHMklgNnJbcsL4Kk7MlcZsDz1jqsHwWjxAVKJCp8xaky1S5aAzFRSos5IA6l+hgj4+BfDdXD7KSTiEpCMfxMpqcSULlCmZEkHmJabeais84IoWNE9ozjNmzL3EOqy9l3GZ2GYfIoadZFOQhSpiwpSiVAatm5gWiOeK5rxjGahU3Eq+dWVCi5mTpilq3fdZJjPO0dOM7jNmDe0ikTcs7SR/GNWEKUHU5T+/rGpXdSbrSTfLJ9F8N2dvT0uhUjBKTim3hZfxKpk+bOI1rK2N0qJLb7Ax4kkqJ06TzG5H74rYoUDpLbagWEMIcuWTqGxJF46RtSR5pZiANI3sbgxJvsbZaFZmjH8fnoP+76KXSyVKb9ZOWSsjz0yh/wBxiMukJWNPi5OInB2PMOFPw6xWsvqq8XULpHwy5UtI28yqMhp8PFcLyNL4xuHQ0eol95qP55/REhTZJEaw4zZdTmLJmK0Sg5mSFpA82LRtBW1osmYKMVdDOlqD6kEbRtR8/HOGinqqaaT3qAXUBNQQCVEMFAD7NwdrbFnePplr7kl+7ShJIT4iH5WU5BZvO5ZuZuOacGOCZqx3C1agJdWuYhJHhCJg1g9LK1W6B/sx8CmTMdLy1uHOgAJUfLcsw9i93i6KkxOzBi4rclV1AtYK6KsCkgP8MxAPMD7SF8uUbsUUhPjLJe5PIc4ip2UMbWjHcawuYoBM+iStGpXiUqWsWa7+GaS77Rvfi3mA5Y4bZmxGWWnS6CZLkHn3sz6tH/ssRV7lkQTzVjIzJm3HcZUruziOIz6hKlKYCWVkIIcF2QE+nlFoRNMqToJKwlT6UXYsxs79duvO0CEKkjSqwlJ0usPqAUzjmR8Jb16w5ZIWRJUuXrSErGtIbbbmbX9T6PcqZZw5xo5ezlg2IrUpJp6uUqZqVqUpKVh3Is5SFhydvQR0NcX07DYxzMp6soqUKTMUEmz2VY22DC35uxjoZkDGv5QZHwHEipSpk+hld4SL60jQv/2SYqyUai7WOOKosnYNhkpbLxHFErUCpnlyUKWf/ZSIicAgFaUp7tSXBYAqv6b8i1jb1jevatxQ1OdsEoA6pdDhS5iksCAqdOI589MkHlZ40JMJmIUApAIVr1JKQ3it67WexZudpWxBe8t4UrMWNYZhNMsqXidTJp30sU61hJ3/ALpO3rtHRgypcqQJcgBEqWkJlpAsEiwHyAiF3ZrwOZjPFCmnTpRMjBaabVlSk7zD9VLfzGtTf4S1omnMA0EW2iGSiE/aYmKl8UJCkO4wiU7KY2nTTbnuxaztGpJaUKCmMxKtASAognSxYM19wwt7vG2+0uSOKElmYYPKBs5Lzp1h5xqcJ0I7pKNJmMNakhKi/wALF/l6td2iVsDdnZXvxInFJRoGFVAHdgFjqlbnfn/pEvqwtIXd7coiL2WFFXESp7zUhQwuewUSH8csFn5Db8iJdVx+omEFzp5xV7hHPbP5biLnIhgf0zUJfyOmzsT5e8WKXO1hH1aWSkpcuNHzvdn2/GLzxFQf5xc5qUlek45PA0p3+C/NiC12tFhVN0TVrCjL0hmLkAfstfmfMv6xZbEHrLKnVMTJBSAwbxO5BDtZn/Ia8quzNxAFdRzssYhM1TEBVRRKKn1D+sSD7hYHmvkIiiZiVpUordhcK0gsBu6t7qI5ezPF8yrmaqy7j1DieHzTTzqaYiYlalFaCQbEvsnkbmxI5wB0TqCdCmvaIA8XtX87Wc9KQsCtkm5cAmmlC4IIHJj7ROnA8epczZepMWoC0mqlBeglzLVspB80qBB9Igpxb1K4u502tXSkhw7f7NLDM9wefpER3JMTEzSyZafE5Cg9yX/ZHO7N5s5O8qOyZLKMHzQ6VBqqmAc7NLU49i8RblqTMnFKlCYlISEqKQ1yLlXMe5b3ESm7JfejA8zGehaVqqqa62JI7otcRL2IPn7XFLiFRknD5uD0CsSnUWKSqgyEqYrSETEm4B/b6RDlWOZzmK1IyfOSRzEyZc7G++3nHULE8Lk4igoqJSVpF2UIsJyXh9/9ll+yYqWOaNTmHM9D3UyqyrMoKdK0oMxUxWlOshDsAHZ7CM0EnUseEzEkkAqDHUCALdR+7ntEnO0hliio+FGPT5VOlC5SJRSQkOD3yIjBOBKpyZaSpROklQckuR5vsS17bRZEMNLTQmcZallgpMyxS6me7WBHI8rxi0nEM5zmn0mUO/T4u7nJKmVcgL63DWdoyZEsmWwl6nSyhqGlXoG5tvb1ieOTspUP8kcAUqQhajhlKSopDkmUlz6wYRz1pxnyrmoTKyKqaVKDvMUNRbTc+kTx7OWVcYypw1kys0S5VNiddUrq108pZWJCSlKUoKj8RZDlrXblGd0+WaGnU6ZKAR/di9olpkytCAwAs0VySQ87UyDN4hYKNKVgYSt7Obzjt5+caUUNEpJliWSi4ZRUQH8+diwPttG6u1EhC+IuEkpUSnB1kEEMPrjy3O+0aXSbgqIQEp0hIWzkAbbAuzHbbexey2ILbjE3F5KJAwLC/wBMz5q1oXKQtSe7SACCG6H8RFsQvPjpKMnTwRZ+9U55u/XziQnZsw2mxbPtQKhAn/7tqC5DpDLlC1/M/kRKoZSoEm0hA9AIhsI5sIVnsIKf5FTdB+Id6QC2223+Qi4YNhnETEqumpKPIy1zFLCQZtQUoY28Rbbc9fwjo2nK1CHanl3/ALoj7aTAKamWFSpKEEHkGiMknhkfBqnLuTMBwjEJ0uoq6GgkyJ0yW+lS0pAURquzvveI99rqYAnJaSS/6RqiDq07Ux8ju4iUTMGiK3a8Xon5Jcp/4ysLKUyT/s7XLE+VusFuQR1QUhWlCUoewtYnZwT6j8bNGYcKnRxKyoU31YrThRKiX8YD73DNv98YU6JqkalMksUMAp7k3OkdT5HryjNOFRlniTlUy5Y1fpWnc8wO8Aub7evOLkE+cRxOkwbDavEMUqEU1FSSVTp85eyEJBKifQCIBcQc7VOf801+NYhrkicoSaanNzSSEk6JRHI+IqUf21HoI3V2m+JIXNl5MwlfeCToqMVCT8a7GTTny2mKt/ZjmYjaEd6m+snoDqLGzewc+e2+9YkglK1IUtDLUpJ1FQUnZz6dbXa+8bq7OPDUZpzAcz4rJSrCsFntRgpITUVjfGxG0pJHqsj9iNQ5QyxWZuzBh+BYD3iqqun6ZcyZ8NNKTeZMUNylCb9CdKftR0Iyhlegydl7D8EwSV3NBQyRKlA7nmVKPNSiSonmSYMIviE6UhnDQQ9oIqSc4+0SG4x5jI8PgpWOpj+pTyjVwOkqsC4ve/3xsbtK4nKwnjLjRxBM2TJqJFMqVM0EpLSwDf1BjWlNVyKovRzpU4EMNKwFekald05xrSbXU+i+G7u3qaZQpwmnJRSazzR9GtQDJOoOLbFvzzgSQnZQYmwJtvs8KWVIV4rOlwFJf/WKkrAUyjoS4cpsSPzyjpG0Z6gbggpa7C43ifHZUtwmkj/+SqgW9URAdStaSAQpLEKL7exib/Y+xL6Tw+xaiUXVS4p3gALgJmSZZDe6VRk9NeK+PI0PjiDlpPiXSS+a+ZIVo+WsRrlKBDiPrcHe8eUxOpJtGznhBCXtDYMrC8+0eIBJErEKdUtbWdaDqT7sVjlGr1TE6GMwKQxQkOyQku4Hls7EbnexiTHalwHvsqysUloBXh9VLmqJDjQ7K9tKjEYEzVSwPrQkhbKJNyHbSSLE+Ru3IxZEG2+z/iP6N4nYQb91UFVKpQJIaYhY/wD30fIRt3tY42KTI2FYSlTHE8TQuYkkj6qQkzFbf3jLiM2UcWVgmZMNxGR9YaaoRNBAIU8pQUSX6hLebXjaPajzCmv4g0NBTzEGnwnCgt3JSF1Cyt7c9MqUOdjtE9QaMWWV3gUCoI1apaPEQ3lt5+/t88vE5NXitThiliZMRSS56S5PxKVqANtnS4A+17R9K9Uw6GClqVqDh9KjzGm/L7uTCMlzbkROWsnZJzWUNNxZc76XMKf6qf8AqX2sBLlt0eJIMcknu0EJ0KAQ7MG/wk6mALWJb3vE0ezXjQxHh9NolKOvDqpSWJLhMwBY3u2orbyiFiUIM2cFIcK3OlyrzBBci+++/nEieytmFNFimN4bVLEqVPpO/IIYBUpTm/8AgWrkLJiHsTsa4461/wCnuLWZlCYp6efJoZY3BRKlpCrOPtKX7gjnGAJYPLShQJYJSkEBQLEcm25sbvs0e2LV5xnEcQxNaAZuIVM6qUpSAwExalu55jVy5N0MfJLmgzCmbLC2JKWOlwGJB38+TXO20SgS07JWXE0OWcdxnuyg19amlkg8pUlLlrm2uYr5RIObdJF/eMN4Q4ArLPDXLeHzh/tAokz59m+tmvNX9629ozKYWSY4ySFPaWCl8UqdKLK/REkhx4f183eNQqkqGtS/CEfDpdg4Zns3J7HcBjG2u0toVxRlGY1sHkWJYA9/O+dhtGpkzAl1Tj3Qfb7QHwsXsLABrjzF4utipu3ssIMriVOSUrSThdQUgEBJGqUH0sCObEWiX9deQsAnaIhdllKf5yZqkJCUfoup2O5KpR2+fRnaJfVrmRM2+ExV7ko57cQSo8Rc4CUAB+m5wPj3si2ne7M9/O0Y2uV3ZAUlQCdkISXId2fmOjsTF+4hoH842cQdLHG5xLoBeyG3B+Y2fbcxjstJmJeVLTMIJGnSQU7gX/y57WMXRB4TMQk02LIo+9EudMpzPkkp06kOQsA6rEeFvI3fn91OmaUr0BK0ndSgOYcEuC1ixdrEbvH01HD6szFkrEcxYIjVjGXJsiZISHGpBEwrllrspIY/6RbMNr6fEMOk1cjxSaiTrTqmBDFmKbGyhdJez+0QCTHZqz8ZFRVZXxSaUoqvHS6zYTQD4R01JG1y6N3VGoOLYB4u5wSVAgYhJJQlQcvTyeRt0br6RjuFYmvCK6TVU1SuROkTEGWQDqSp31MCWLsq43S9nj3zvjS8fztmDE57STiE2TOOlDo1dxLQVJBu2oKYbMWa0OoPgLABYUlQKhqCSAUq2fUnfncbHpEqeycUrwbNC02UqtkavE4fuz02iJj+MKmy0h9ylLAebfaDhi3TfrK3skt+hs1JCVJatpyUqSAR9Wq3mGZjBkokX67wFIb/ADh2baG1uUUJNK9pmR3nB/Mo5dzLPX+uRENiszJ80TD4CtXxJ0tuGcG1mtfbrvNTtHyxM4QZqBLH6GC48piTELe7VKq2YqW5AKwFKWxLvbcj0I+cXjsQxy+8IM2dMCglPjV3Wo2cjUALJt5M7x0VyagIyjgCRsnDKUD/AMKY51TJSghae5W2knSlBPRm6H0t6x0VyYonKGXyq5OGUr/+JMQwi9NCXdJewioWf+MUrPhL9IqSQ47UIUeIeFBBZ8HV1LnvzYgXbd2vGkpC5X01SVMFpuFEfGFAOdyfL3uDG6+1BMCOI2EklASMHJJWeXfnYNeNJoQFLZRUuUEkpBIY721X+ZF+ljF1sQZ9w0z9N4eY1PxWSUz6idSrp0pny9aWJSTYLSbaNwSPLmNo/wBKTFSFaaOhBB+FVDMBA8/9ot57biI5rUpSFmUVGXLdSlADS5AsOvNiOvOKV1AnazLITMHhc7lutw/I2c2hggkcntT4moqehpgxI0HD16gzC5+kNzPnGbcJ+OGIZ/zgMFqKWiRIFFMnrXLkLlKCk6WABmKceIvYM28Q9lTVKLzQHYByFA7O5d/T06WjdnZcUmZxMm6ApkYTPIJVdiqWxZ+f4jziGuRKJkKAALD5RFLtdqCcQyQSNf19cGYX+oHW0StVs7s8RP7XiynE8jp7zQ9RW3dnPcps/nt7xC3BH0LBWQlTFGoAk6rkEkna3sDzY3i75bxr+TWYsOxejSJ9RQzU1CEKOoEoLhJYO23mzsz3sSi6RKQsCYpAUoqKgByPKxu7Hb0hKmIk00yZVKSgM60LPmGuDY2F9g/QPFyD7ayvn1tfUVeITVTqubOXOmzZxAXMnqUVLmFJuHJAO7Bm2DePfCYlClkpkoAKQraWEvd9iLcjsNrCPKYlKARLQZazZKVFJIt8QDl+V25R9dDNRR1cqfNlfSJcqYZiZZQ4WQQqwZjfqzsRs8AS57OXDI5WwJWYcYkGXjWNS0K0rB1U1NuiXe4Uo+NXO6Un4Y3qLC0Yrw+zfT52yzSYtI0CcoaKqWguJc0fEB/dPxA9CIykeUULD5biCAPBEA1rnDhjgebyr9NYdJqiQ2paATGjcxdjfKVeta6CXMoVnYySQ0Sz0AjnHmuShQLNENJ7loycXmLwc3OI/ALFeFdOMUpsTqK3C0rSmdKm3KUqLavYtGDF0AAgJJJDEB39PaOi3FzKMrNGTcXw5aQoVFOtIHQsWMc5paJspCpFUCJ9OsyZqVcpiTpV94/CNf1KioNTij2LgbUp3EKtrVk21hrL6bP5eo0zCzy7MzE7/MxJjsd5iTQ5rxbBKhZT+k6LUhJ2M2SrVa/7Exf/AGxGdJQSQo+Es6QHt++Mq4dZpn5KzbhGMUiVFdFUpmmWLlaQSFI/6kFafUiMdb1PZVYzN31myeoadWt1u1y/Fc1+aOndjCPMdY8MOr6bFaCmrsPmiopKqSidJmJNloUHSfkRH0h28o3Lc+ZWmnhmvOKmX0ZhyjidDNSFifIWi/JwRECaUrnyQJiFqnpeWtDagSmywE+RSS1+cdIsakpnUk1KgCClo595wwtWB50zBQzUoTJl1ZmpSpIuiYCpnJGx1n9+8WRBZqeYUzZTrCpSlCy0pDWIuwZmJPXdhaLlm3Gp2L5jqqyrVMnTymWgEDWdMuVLlpbfxaZYcf3t4tgnBCUabkFRBJ0gsSVO3R/LzJilcmb4+7SmZKWFaOZN+SW6DY2ixUroJM+vq5OGyUPW1lSiQjSixWtQQk6SXFyOXLnymFx4yVLq+FNdhmHSgf0XSIVRgcjTgFH/AOgjQXAPAP07xYwIKCu4oiqvmBKSEESkkiz/ANoZe4ETSzLRIrcLqJMwakrllJDb2irLI5wSalE6XLVT6lJqEJUCWLuHZiXZuvQbjfIMo5gnYFXV8+nWmROnUU+n1pUAlAXJmS7cgWW7cykekWSfQzMGqcTwtW+GVs2mGpLukKdA/wC1SOR94pImoeWyu7LpAUrWkK2YjowT1ZwQ8WKlCZelI1oCAjYqWxSkA3YFuo8TfgIveTMCmZizlhGDy0EmvrZVJMQoXKNaSs77BGom3pyMWdAK5q5ctK5hcKDIJdQLXBNrAb9DzjdfZgwdeL8TVVy0FErCcPXPUnSW7xf1Uu21gqawazebxHQlEzkhKWEsAJFkpZmHIRTObQXEem1rkekec0eE2bzihJCftKJV/OjIUha0zBg8rSEAX+tnW+d41BrX3q0nwJcKSSjQSeYLX3PK3SNudptRPE2ToV3ZThElSVktfv537njUkqeZcsKdIl3OgEgqawDm3lv77xaJBvHstrP85M11E6sMqXKks3ilnZ7e0S+rT/s6/wDDEP8Asul+KEwaZaNOG1LpCWUC8t+vkG6xMGuS8hZJItEPcI56cQlpRxEzmgPqVjU5SSlIJsEn32fflyvGMI1KYrUhSkkkMltKnZ2+G7Pc8ucZRxBCTxGzgk+J8Ynuk2sAh+TjYMRs/lGMSlylid8KTLBHeJXq0ne+x5ubHny3uiCS/Zpw8V2W83SarRMSuopmAc2KJu7kmI953ytM4bcRa/ByruMJxOYqrw5SrITMP6yW219w9t+sST7JcgjB81ahZVRSkWa2mby5fKPftKcNJmbMqTKvChoxjDliqopqRdExN/kdop1LEVCEGb3qChUxQ+F3dreLpcG5t+J9lJWUoTrACQUpT3l1Pf57bH5MY+PCMROM0MurKFIWbT0LBJlTEnSpBJI2U3W2lxHqsJUVLYDXYhHgLuwNjq5h/nFyp6JW6krQiWWdSdSfDy6Xfr+HOJW9ksvguZytYUv6ZT6hr1EfVqs8RNkT0zFzBJCiSoBaVOA9hrSTuGsQ+xe8Sw7JCUfoTNJlaSlVbIPhU4J7tTt5PEPYlEjHtCNt4drsIRIHkfnFCTUPaRLcH81D7RowwI/5iYhYXCwWTKSuYyiwcqJ5HZrNcPf1ianaRP8A8QZocn/hU8v+Yn3iFU1SVKmbI0TGlkMCS+17kM/P95i8diDzM3Ugg93KAJ1aCV6geYt5EW2HWOjWSS+TcvEgOcLpXAFv1KI5xzRNX4dSvD8Iln4weX3cn9t46N5JBGTMugnxDCqUFv8A+lEQwi/7ExRMbSYYtfnCXdJeKkkM+1EtKOIeGEkBsGLF9j9IJ/d+HvpJZWtcyY3c96dUwlbhXiLAXsbb/wCkbt7UCRL4h4atSmScHUCCph+vO/lv16NeNKypYT3mtBl61W5JUHZm62HqbxdbEFxwXIuNcRsTl4flvEFYZUolrqZ60oCwtKdINlC51FNxaMmHZaz4sAKzZUFxpvKRt028zGc9lmV3/EStM4BRThFQEkGzGbJO7/u94l8KNFykJEQwiB8rsr56+FWbalA2tIRt/CN89njgTWcNa6txjMGOVuM186R9HkImBKJchBUCohIFySkb7AW3jfIpkDcCPdCQgMCIjJI3sYiZ2vyP0hkkkpfv60MQWP1It1iWZuN4iZ2uwoYrkYghDVFap3/5IgtyCPXdJXLSyUEl9SVTBZz1b/Mx6S8EVmGYvBKczEy8SH0R1q1l1q0+rjUz7bQaEoLqlp1pQGQBYEHoQXd77ta8ZTw10zuIGVkqdQVi1OkAkEH61JcMenLlfZgIuQYDhia3D51Zl3GwpGMYVMEqcoIczpY/VzR1cMkvzFzeLuEy5UtlESgbMxTr5sPEQDtYNyLRuDtO8N52G1EjPWAU3e1FCgpxCSgMZ9Mfi/6k/ED5RpmkMqZSyptIoqlTPFLWg/ElQsSxYm7h2Z/nCeScG4eAXESVkjM/0GtnlOFVwCKkMQmWrUfrG3cE9LAqHIRNcEEApIIOxBjmfImKUpB7xYmJZSL8w48PQltt/viZvZ/4hpzPl4YHiEwHE8NQ0oleozJALC7Bymw66Sk9YhoI3KIIT8jaCKknjcEvCs1mgZ3Ywcm/GALfiVP9IpZiFBwoNHPDjxlKZkniLUzu7KMNxlXeIUAQEzhuLftAA+ojo3NRqSW222iJPa2zDl9VPJyv3UutxtRTPmq3FGh3S7X1q5Dkm53APTvFB0JePY2Xhqd1DVKTtVl9f7euf52IrOSQXUs9fz5xXJJCkru4PxAsQeV/WKNLgl2c2YHbygF0lmUzFtjv6feI1E+jUTT7K/E6XimD/wAk8UmgVFPrmYeVGxR8UyUP8JOtI/ZUR9mJKEdAY5ZZcx+ry1ilPX4fNXJmyZqZiShXjQUk6VAkfEDs77kEXjoJwg4sUXEzBApapUjGaZI+lU6TpCx/aoBvoPMX0lweROx6fdKcfZyfNHiXF+gytK8r2ivs5b+T/Z/qZ9Vy9UtQIiFPaGwhOE58pa5UtJk4jSrkq8ILKQdQ+4q9hE3JgIQecRm7UuDJOXaTFloZOH1aJkxe7SydK/8A1UYzC5HnRGadUIIUoTfGG8R8TAbc9wwbkxu8eaCVTJilIQgXCfEwe9nYF7e9+gihc+nkSwtFTK16rFMxKuT2vYOSOex9lS1EuYtRXVyEKIBQoTkkjckb38+XPpFsjBJ7sj4Bqn5lzAtBGhMnDpR02f8AWLaw5d1taJL1ssLkqCrWjXPZ5wJOCcKMEUpGmbiPeYgvz71ToP8A4wj1jZU5LoO3vFAQJ4yYQcC4q4omURIGK0yKhBUm2pDoW/sURrtE8rlzUyxLDOEEX8IDM7Ak3Ivy+6QfaqwYUtTgeOJ+rEmeqnmr6JmJID3H2gnnEfJkyjMxKZs+m0k6gvWkuSRup9ixc3/hdMjB7yx3fiUuetYJKVkOVq5l+pA6H05RLrsmYEmkyZi2NTENNxOvMpC99UqSNO/TWqZ8oiCF08jVMTU0oSgEqSmcnxgPsXsX2bfodh0Q4VZeVlbhzlvCpwInyKCWqoBDHvV+Nb+epRiGMGXEGPOYCUKsYrYMbR5zW0qYtaKkkJ+0oSOKEnQQFDCJKkupnadOf7vRt3do1FKWtQBWUrkDxTChIXrL2LEtszvs3KNudpZaBxPliZOlSh+h5L6lAKIE6c6g5Gzh7ixjTwTTzJq9c6mKyp1kzEqSpmILA+TP5cmiy2IN6dlYH+chXgUP911GolyN5TNy2I+XtEwq28lbWsYh32V5stXElYlzpcx8MqCAlQJKXRfc72O/P0iYtY30eZ6G0QyTnnxEUr+cbOBCylsZngDvSArwpe2zs/r+OKJec6lrVqJSQkS9QCfW5TYgt62jLeINRTyuIecDNqEyyMZqAB3qEm+nkSDv7EPGKpMmVLmBC5QcMAapAVd7Eu3J7+cWKksOyXfCM0BWlWmqp0lSdiQmZ0+fvG9cWoUVlPMlrSFBQYho0D2P5smbhObDIWlRFVTawJiVEHRMsdJsf9ecSRmoCgXeKljndxayYrh5xGmGWhcvBcwzCU6HT3VSzMCAW1ps3UCMbppcyVKSpQCipRDrcE2fTuLs1iSd2domPx84cSs85OrqQJCalKe8p5g+KXMF0ke4EQpwvFVrpZyK2aimxCQVSKySbNNSWVY8j8Qu1+TRKBcVgoOoqKUSk6UmWtxz8Nxs7s13sRyMruyWsHCM2DWqYoVsjUVJY/q1b/nnETJdVToQmYKiWq1j3qFBId7kXYi9yQTEr+yHNTMwPNCUT0TSmsp3ZSVEEyibttblyDQexCRI8bRS29ocJvy8VJNSdo0JVwhzWFFP/Bcyw+NO8QhmLSZ05Jm/Eo+GXMCgbkORsdvSwMTc7SGo8IM1JCgn/Y9zyAmJiD65tOaxc41UpKZkxQLTEeIOxLv6OSOnrFokHvSolTdM1SzM8BSBp0ltNrt0It6ekdHcmhP8kMB03T+jKVj5d0mObon0EuWFKq5KtSHKhUpV1AuVNsTtf5OejuRpyZ+SsuTZawtMzCqVQUGIP1KecGEX9veKZnwmKnimYPCekVJIb9qA6OIWDzNSUgYUsklGraeeT9TGkkHTLBWRLBJCmU+vdj0Juwv6223N2p5kscQMIRNXKlpOFG8xQDfXl/wHWNLqmSJwCBVyApSHDTQNnZiC12T/AKRdbEGSZUzfiuRsQmVeCzlyKqZIVLM1CwixKXAZKhpJAJ3+HeM4PaAzf3igjF6khA0gGpSl1X3dG+3PmPWNUKmy5OpIqpB0qVczQQ5uymY36hrNZ485s2iBVOE6Slara+9F07eIA3Hm/N4ciDbau0BnFCUlWKVQJISWqkWZ3JOhhYg+fLeEOP8Am8IWF4zWAKIZQnodIcXbu97i3nGn5dTKWmWxkSESyCAmckH1Zw/kGLX2j1MyUioKDNlzEJ8StM4LULtqdKtr7Dk8OQOiXDnE6zG8hZcxLFZxqa2sw+VOnzdIGtZFywtEdO106cYyMZIPepqK1iA/9SC/3P7RIDhMsL4W5QUhilWEU5BSQ3wRobtcBAn5MnTFJSEVtUl1kAAmRY3ty5xVbk9COUtTSFK8KkEEOB4VAfZP3eYZ+kZdwqla+J2VkqJnrGL07rJLo+s8wAQw5c/cxh6qumExaZdVJUvSE3ny3vyu5Zzy+6Mx4U1UgcTsotUyVleLSDp75Lv3gBYAu+/yO8WCJxZmwOVi+GzqaehK0zEEEEOCI57ZlytO4Z5yxHLNRLCcPqddVhExaXTocmZJ5vpJKgG5mOlS5YUkpIe0R87SHCo50yyqpwsIlYzhyvpNDNb4ZidgfIhwR0MVXIkimszEEpRpWLKDLV4mHR/E/ne3tGR5IzfV5MzHS4rQTkqVTTHUQfCzkFKgORFieh8owqhxmRieHIE1cmlnIdNTJmrSgyZidQWCC2x9tmj6UVVLJKZ6qyQkTBpQlc9PiFnHVO5LE8iGMXKnSvLWP0mZ8Eo8Vw9TyalGrSSCZatlILcwXHs/OCIrdm/ipJwTGU5axevpU0VfpFOO/SdE1mTd+bBJ9UdDBHGWJbANuHhvu1/eDny+cIsQRAGtuOPFFPCnJKsUlS0zsSrZ6aLD0zA6BOUlSta/7qQklvtFhzjndiWI1WL1tXiGJT5lZVVUwzaifNUVKmTFOSonqfly2aJ69oHh4OJOT52GzCpMyUe9kKH2Jg2PrHPsyqzBMSnYLmBBlV1MrSrU6RMQ9lCMJqVOo8TWyPU+Bry0pSnQksVJbPuu3w38z1sfMN1AfyitDsrTduSm/O0JbI1E3HK3L8/jFISWU6DvyH+cYI9fzgrOhbjUkF3BBI1e0XzKmacSyjicitwufNkzZEwTEGUsoUgj9k8rWNiCLEERYEuuWRNOkOw1Ow849EgIQymWnmAot84JtPKOOcI1YuM1lPdE8+E/aFwnONLKoszTpGH4s4R3/wCrkT1EWBckSln9kkpP2SdhnmecpU2bcErcLxCWFyKmWULBHIiOa1NUqopwmSVzpfIrQzhPO2x8wbGNx8Pu0bmLKEmTSVM1OIYcgN9GngrQkOfhvrR/0kgfsxm7fUcLw1fU8p1ngluTq6e/+r+T+T9TMB2M8sBavqFKS9hrVtGTZb7HWRaSukz8QwtNUmWoEy5qypJY8xzEZjlTtJ5LzAhKcSM/CKgtqdP0iX/3IGsD/EgRtLB84ZaxdCF4RjuG1WrYS6tGo/8ASS49xGYhWp1Pdlk84udOvLN4r0nH4cvXYv0iSiRJly5SUpRLQEpSkMAAGAA6Q13SRFSfGnUgFQ6gOIS1BCFLmMhI3KvCBHKY413xI4f0GfcDqcJxeWJtNPSyhGgT2Ncpaj9Qr/vV/GJM45n/ACnl9ClY3mLCqQpD6FVSVLPohJKj8o0rnTtW5dwbXIyrh0/Fqljpn1YNPIHnpvMUPZPrHBUr0qfvSMrZ6VfXzxQpN+eOXq+RXkDso5JyzjdLiisMk1FRSzEzZRnArZYLgsbWMSSSG2N/WIA1Hafz5UVC5oxdVKFnwoppEmWhHkAZai1uaiYf9JvPniH6Zq0uB/YFj5fUx0vpKh5m0rgjVGt4+r/Yn8SfL5x5TvgN+UQFHacz8CQMaqS90h5HyfuYFdprPxKtOMVn+E9wbN5Sd4fSVDzI/wBj6p3j6v8AY3hxs4B4ZxTxalr8QCxUU8oy0KSSPCS7Rq2R2KcGmrHeTZ4RzZR/hH0cPu0/jkrMaJWc50zE8LnlKFJWiX3iH+0gpSnxf3S+rYEFnmJhFXQY1htNiGEz5VXR1CAuVOlFwpP7uhBuCCDcR26FxTuFmBruqaNeaRNRuFyezXNf+mtOCPAvLnCIVtTgFElFfWyxLnVK/FMUgF9Lm4D3IHQRtmpBmSlpHMR6pSEhhYekMhxvHZMIRcz/ANlLLuc814hjtXLmiqrpgXOZZGosA7e0Wah7FmTkTR9Ipps1L7KmFoluZINyH9oYlJGwIgTkxbhvw8wThrl0YPliglYfSmYZqxLSBrWQ2pR5lgN4y3awLwJDQzz3PrAgtuIUKaqUtCw4VYhojBxC7J+A5tzFPxYhcibPbvO7OkKPX1iV5SFeceX0dJJcCAIc4d2K8smaDVJnTE9Cs3iTfDLh5g3DPLKMFyzRSaKl7wzVplpbWssCpR3JYDeMrTIQD4d/SPZI84AqBN7fdC23aGx6wuX8IAxPPmWZGbcu4hg9akLpa6QuTNHVKg0Ri/oV5XCzplzFJ5ArVExlICheKBToZ2+cARkyr2PcjYbXyaqvwuXWmWsLCJ5UtJIPMEsYk/JlplSkISEpCUgBIDABtoSJYT0j1BteAAG0ULDhTh4qf39oRcgwBovjHwIwXipW0VVjkgzZlGlSJZuGCjcW9I1d/Qyylp/4ZRL/ALZiYKpYXyEUGnGzQBEH+hjlR/8Ahz7KP8YrHYxyj/8AWU4/vH+MS6+jAfZAhinDbQBElPYyye96TUP7y1ReMG7GuQpNZKm1mFIqEIUCULJKT6iJQCQm4DRVLRp2EAUUtPKo6WTTUstEqVJlply0ISEpSkBgABYADlGreMHCTCuKuHU9Dj8ozpdNO76W5bSpiOXlG2rdY8jLCyYAiKnsX5P2+iFV9itUbJ4U9m3KHDjH5eN4XhcoYnJBEqesa1S3BBZ9rHeN3iSndhFaEhIYQBUw/Ii3YlQorJS5cwBQUGi5Ab7xSQ+7mAIw5s7JuUcy45V4pUUQTU1K9cwpcAnqwO8WpHYwyUCCqjJ6+JQ/fEsO6SYBJS8AaF4ddlnImS8fpMapsGkzq+imCbTrnOsS1jZQBs45HlBG/wAJCRa0EAePLyhG4gsPKBwN3A8oA+GtpBOlnUHB94i92h+Bqc0UasWwRIkYtSuuWtCd/I9YlaWIsecW+voU1MtQUHeIaUlhnJTqSpTU4PDRylpamYJ0+hxGUabEqclM2SQQ394DmI9VzEy/GshIbc7ARKDtC8AJmNr/AE5lOUJOLSXLJDCYOhaMT4SdmDF81TpWI8SR9EoJZBTh8okGaeq1dPKMBU06XtMQ909cseNqUbJu5Wase33vPy8zQkk4xiUqZOy9hU7EJMr45xQrR7HnHlR4oies09Qk0lYD45EwaS/90HeOnOH8P8HwjDEYfh2HyKemQGShCABGoeJ3ZtwHOEqZNlUopqwOUzJYYvyjtS02n4MLfuYCjxvfQuXUqJOD+72/B9yGGhQSCnxOCWHKPRBKwUggKHwhvujJc1cFs7ZFmTDIlfpigQXSFg6mG3iF4wpGMJE5NJiVHU0VTqYImoLE9HH8IxVWzrUueMo9F07ijTtQxFT8Mn0l8nsXBACBvpIDv0PX1tH2y8WrR4RWTVBmImeNt+rx8buhQSA4sWuD+f3xWVuolTbMCEW/Pz3jpI2lqLXMu8nNWLU4SmXWKSGceFLDlZhBOzPitWlX0mtVYeILSlTcucWYabAsoA7AeUJOoo1JU4AYKuYnxS7nH7GjnPhXoe8yqqZ6TrqJirDUlHhBHt6R4hJEtTMCSxVd/wAfxjxVVSZIJnTEIA6WYj8I+UY1JmzxLw5E6tnqLJRJSVqi0YSn7qycVa7trWLlVmorzaLgAEpUSVHlc25fnyhBWokoUmYkXfU8ZtlPgNnjPKBOqpP6BoVBxqH1qx+6Pgzt2f8ANXDoKrMJnTcSpt5iSC5jvx0+s4eJ79jT6vGunU7hUo5lHrJbf5MbQDoWLFHTT+G94AolIIJ07E3sesW/DcXkVylypgXS1KB9bLmKO/MxcVLuUkuVXBKgSD6xjpQlB+GSNzt7mjc01VpSTi+qKftXS/O5Dc/SJcdjvFMx4l+mtalHK0pDCZNBaZVuP1fLwpfWrmSkXIeNE8IOEGI8W8XDIXRZZp1j6VVocGcQby5Z/FXL1joRlbLeHZUwamwzBqaXSUlPLCJcqWkAJAjM2FrJP2suXzPMOL9foVKcrCilJ9X2x28/MvY8rwx5jfa8IF9rQC3+YjPHkobbOHhh+Y99UA9YQBcnaADyDwxe8IAmC7WeAH62gYD/AEgBt8VxBtygAFv9IGvyeC/X98MHZ4AQL9BBd25+sMs+8AHT8YANoQG7JbzgAB5H3hsOkAICG0DWIaByeRgBj1hXf98F2veC8AFuZc+e8DCAEjkBD6kfKAKWfaGkMDDckHrAPvgBN6wh6t5RUG6vCttACbpbz3hiwLO3SAPDAHIP7wAgCdvwhs3rCYObmGByc/OAECIPaHzv98H3wAfOBukD+UIECAGPNoIBs9jBAHzjn++ADe1oQc2g+EkB/eAGw5u8UlALxULPbeGLu3LzgD4J1CiaXWARHrT0aJIAQm3kI+lnuA0MDqBv1gCnR4S7R8s6kSp9QEfZY9fYQWI3LekAY/WYFKqUqEyWlYPVMRz7SfDLD05HxTFqKkly6uhSmoSpKGPgUCfuBiVTWMYRxKwVONZTxihmBxU0k2WfdBEUlHxRaOahUdKrGa6NP0ZzTDagQD5bC3l7R6KcF0XAva4Pzj5qYr7iXrQdYSEq5+IWY+4isLAmOAUlJZLAb/i8aU1h4PqWnNTgpLqVrJU6k6lEenytBLBUpIVYD9oN+/3gBvZwTyHNuX52j3w7D1YpW01FTuqdWTkU6CCSdUxQQPvVBLPJFpzUIuT2RIXhr2UsJzRljCMxZnVOmz8Up01f0fWUoQhV0DT106X9Y37lHgdlbKaU/o3CqaUpIDKKAT842fh+GSMKoaWgpRpkUklFPLDfZQkJH3AR9aUNsR8o3SnTVOKij5fvLupeV51ZvOW36stlPhcqRLCJaEgANYR8GLYBT18lcuchKkqDEG7xkgSD5iKVI67COQ6RDTjL2ZqbFTNxTLafodcnxAygxJvGtOGnZ+zVm/G0UmbEfQcJp1j6ROl+GZUAH4QGs/Mx0KnUKJrggMerQ6TD5dNdCUiOGdCnUaclsZO01O8sYShQqOKlv/O/mW7KmV6DKmEU2G4PTS6OlkICES5aQAAIyAHkDFIAAioeR+cc2xjW2+bHuD97wuXX2g5nqIe7dfKBADnt8oYhW8xB98AMX/gYG6A+whWYww9w8AEIO9obnmYNx+LiADneB4AC3SC6bDaAGNt2hAsd4QvvDAL2NvSAG4Ys0ANjCuecK/WAH5kQ9+rwn+frDD/kwADbmIW3UwwXJtBfZ4AAfN4HgDh2f5wev4QAC8A84Ga8Nx1IgADnk/vACdmilug++HbmLQAGz3hh+UImAG3hPsYAfvFNr3fygf1h3Ni8AA28It1AhvALi0I+0APU2+0MEMYpHlDA3Yn5wAOBtBBu97+cEAfP1Cmb0hMwIeA3v4ngAv5+ZgAa3Lyir72g5Nb5wdbke0AMEHl7Qn6kCAg7kv5gwgWPUQAwAHIO8DW5fOGBdn35wjezC/nACZhyvFrxiQaijmoAuoWi6tZnf3Eea0BYOr8YA5wZm7P3EKhx/Ezg9HSVNAupmTKcqUQdClFQB+be0WQcE+J6SWwqlBI/tDtHSxeGylElgfWKP0XL/ZB9o6js6DeXE2CHEWq04qEazwvwOax4PcT5aVD9C0xSS7CYrfrGzez/AME84z+I+EYpm6hpsPwjCqgVagFlapsxF0JAOw1MSfKJujC5X7APoN4+umpJdOXShvSIVnQTyolp8SatUg4SrNprD26/A+lIA53irb/OE49usNgeXvHcNdAAH1gvvvB5WIgduUAMJ9YAGdgYAC9mhML2vABYg2eGOhvAL7NABv1gBuGtAdoT+bwdbQAw17j8YQG9wYYPmIIANjuBAHaxH4wN5XgY+dvaACx8vWBncv8AOEAeVoYDAvcQAP57dIYI5ufeFy22hi3wk/OAG7j1hMBA+ncwahABvaAIAJIJgBb184NxeAG97wAgvz9YB0PzgBF2aAAA3+6Fs939YfofWEwMAVP1aKd9t4AWJEN/L7oAY5wrdbwPbf7oW/SAGm73Bgcc4W1oYII9OUAAa4s8MG0K3nAD1vAA/WHyPWE9mNoOVr+kAPz5whzaGLiE7X3gB8rwh6QP1+cJIfzbmIAqbnBA7WBAMEAfMLPu8P0PLaC43vCIF+UAMOd2gA3J/GECQLsfug22I9HgBjTyceYhuxbmfvhPYvA/hazekAPZxbyhAlnH4QaWHWGAehgABuf3wcvCIAD1284W3r5wArnqfKAAjfeKt+X3wDmOcAIkD4g0MG0F+QgHk994AbEQDZi8JtJ2eG4MAALdW5mH5bwrm37oYYb2gADh7QODuQ/rB6X92gBMAPYW3gu3iAghejwA35vD+798U/fDItADHyhJ3PMQDbpB63gAAZ2+UPbf74NtoQ9ngAt+yX8lWgPoPaHt1MJ9w8ADww8KGAfaAH1/hAL84XOGLBnMAA94APaFyO5gHz9IAADcKYDqIA3UQdXPzMDBrAQA/wB0IjeB/Yw3s+0AID1EVb8oV22hesAVPAPV4Qt7wbdbdTADZ9wIXO/zhv6wt+bwAXA5wBztt6QWYgBvaDd+Y+UAGwvDFrj7opAbZvSGACeb+kAGkKFwT6Q9LdT0eBnH8IdmtaAEbcvWF+d4bPAx8gPWAE46wQabEOD6wQB4AhobwiHeAB3HSAGOrw/Qwth6wAFyX5QAA9CflBzNzAosYNmgAHs0NwAzxSwu94aWY6XT6GAH6tDt1F/OECxFzfzh7wBTzseUO49ekIFiQw6Q/hJHTnABv5eohjn+XhjmIoYBTACAKm/JgD9YbedopBeAKn6QCKNTANDBHSAKvPnByN2gSdRY/dDaxe94AAbQh5wbkiKVFrbwBVvyhgQgd4bufWADbf74Q53hmED5QA+X+UP2MIdBAQ7jpABqd3MHkd4AH3/CFqZZYC0AVXaAFuULSLltoAdQgBuS+4gHPkIBcsYpdiw2gCrYsRCFtoZ335QAOH9YAfv90HK+3pAkWLW8opBctAAGYgEW5Q3tt7wy7XLxS/Rx7wBUNn5QD5RSlWoX2BhJXdm5QBW0HWEYDZWnygB9IOW0BFopSoqdrQAy/ID8IHPMwKVoSVM7QHwsOsAAJa1/eD87wbFt4YFj5GAAMzjcQiS7w1nSRz94pSXPS8AVbvz9IG6vBcWd+cH7oAIIAHMEAf/Z";

const anthropic = ANTHROPIC_API_KEY
? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    : null;

const redis =
    UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
? new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN })
    : null;

if (!anthropic) {
    console.warn("ANTHROPIC_API_KEY tanimli degil - sabit yanit kullanilacak.");
}
if (!redis) {
    console.warn("Upstash Redis bilgileri eksik - konusma gecmisi saklanmayacak.");
}
if (!TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN tanimli degil - Telegram entegrasyonu pasif.");
}
if (!ADMIN_ACCESS_KEY) {
    console.warn("ADMIN_ACCESS_KEY tanimli degil - toplu mesaj (broadcast) sayfasi pasif.");
}
if (!TELEGRAM_BOT_TOKEN || !ADMIN_TELEGRAM_CHAT_ID) {
    console.warn("TELEGRAM_BOT_TOKEN ve/veya ADMIN_TELEGRAM_CHAT_ID tanimli degil - admin bildirimleri pasif.");
}
if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    console.warn("GOOGLE_SHEETS_WEBHOOK_URL tanimli degil - Google Sheets lead aktarimi pasif.");
}
if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN || !WHATSAPP_VERIFY_TOKEN) {
    console.warn("WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN / WHATSAPP_VERIFY_TOKEN eksik - WhatsApp bot entegrasyonu pasif.");
}

const PRODUCT_FEED_URL = "https://winkelgroup.de/api/products/xml";
const PRODUCT_FEED_REFRESH_MS = 6 * 60 * 60 * 1000;
const PRODUCT_IMAGE_MARKER_REGEX = /\[\[PRODUCT_IMAGE:([A-Za-z0-9._-]+)\]\]/;

let productCatalog = [];
let productsWithImages = [];

function decodeCData(raw) {
    if (!raw) return "";
    const match = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
    return (match ? match[1] : raw).trim();
}

function extractTag(block, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = block.match(re);
    return match ? decodeCData(match[1]) : "";
}

// Instagram ve WhatsApp mesaj API'leri WebP/AVIF resimleri kabul etmiyor
// ("This attachment format is not supported" hatasi). Urun fotograflari
// Cloudinary'de duruyor ve Cloudinary, URL'deki dosya uzantisina gore formati
// aninda donusturuyor - bu yuzden .webp/.avif uzantisini .jpg yapmak yeterli.
// Cloudinary disindaki adreslere dokunulmaz.
function toMessagingSafeImageUrl(url) {
    if (!url || !/res\.cloudinary\.com\//i.test(url)) return url;
    return url.replace(/\.(webp|avif)(?=($|[?#]))/i, ".jpg");
}

function extractImages(block) {
    // (?=[\s>]) tag-siniri zorunlu kilar: <images> konteynir etiketini
    // <image ...> ile karistirmayi onler ("s" harfi [^>]* tarafindan yutulup
    // yanlislikla eslesmesin diye).
    const matches = [...block.matchAll(/<image(?=[\s>])[^>]*>([\s\S]*?)<\/image>/gi)];
    return matches
        .map((m) => decodeCData(m[1]))
        .filter((url) => url && /^https?:\/\//i.test(url))
        .map(toMessagingSafeImageUrl);
}

function parseProductFeed(xml) {
    const blocks = xml.match(/<product[^>]*>[\s\S]*?<\/product>/gi) || [];
    return blocks
        .map((block) => ({
            barcode: extractTag(block, "barcode"),
            title: extractTag(block, "title"),
            category: extractTag(block, "categoryName"),
            description: extractTag(block, "description"),
            images: extractImages(block),
        }))
        .filter((p) => p.barcode && p.title);
}

async function refreshProductCatalog() {
    try {
        const res = await axios.get(PRODUCT_FEED_URL, { timeout: 20000 });
        const xml = typeof res.data === "string" ? res.data : String(res.data);
        productCatalog = parseProductFeed(xml);
        productsWithImages = productCatalog.filter((p) => p.images.length > 0);
        console.log(
            `Urun feed guncellendi: ${productCatalog.length} urun, ${productsWithImages.length} tanesinde foto var.`
        );
    } catch (err) {
        console.error("Urun feed alinamadi:", err.response?.data || err.message);
    }
}

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_HISTORY_MESSAGES = 12;
const FALLBACK_REPLY =
    "Merhaba! Mesajınız için teşekkürler, en kısa sürede döneceğiz.";

const WELCOME_MESSAGE =
    "Merhaba, Wintek'e hoş geldiniz. İş güvenliği ekipmanları ve endüstriyel el aletlerinin yanı sıra, WINKEL'in yetkili bayisi olarak sanayi, otomotiv ve denizcilik sektörlerine yönelik yapıştırıcı, yağlayıcı, sızdırmazlık ve yüzey bakım ürünleri sunuyoruz. Ürün ve hizmetlerimizle ilgili merak ettiğiniz her konuda size memnuniyetle yardımcı olalım.";

// Ilk mesajla birlikte gonderilen hazir cevap butonlari. "Buton sablonu"
// (button template) kullaniyoruz cunku bunlar - gecici/yan yana duran ve
// cevaplaninca kaybolan "quick reply" tipinin aksine - mesaj olarak sohbette
// kalici kalir ve alt alta gorunur. Meta bu sablonda mesaj basina en fazla 3
// butona izin verdigi icin 6 buton iki ayri mesaja (3+3) bolunuyor. Musteri birine
// dokundugunda Instagram bunu bir "postback" olayi olarak gonderir; bu da
// handleDirectMessage icinde postback.title, sanki musteri o metni yazmis
// gibi mevcut AI cevap akisina veriliyor.
const WELCOME_BUTTONS_PRIMARY = [
    { type: "postback", title: "Stok Durumu", payload: "QR_STOCK" },
    { type: "postback", title: "Fiyat Teklifi", payload: "QR_PRICE" },
    { type: "postback", title: "Bayilik", payload: "QR_DEALER" },
];
const WELCOME_BUTTONS_SECONDARY = [
    { type: "postback", title: "Ürün Kataloğu", payload: "QR_CATALOG" },
    { type: "postback", title: "Teknik Destek", payload: "QR_SUPPORT" },
    { type: "postback", title: "İade/Garanti", payload: "QR_RETURN" },
];
const WELCOME_BUTTONS_SECONDARY_TEXT = "Başka bir konu mu var?";

const BASE_SYSTEM_PROMPT = `Sen Wintek'in Instagram hesabı için çalışan bir müşteri asistanısın. Türkçe, samimi, kısa ve net cevaplar veriyorsun.

WINTEK NE SATAR:
- İş güvenliği ve el aletleri: iş eldivenleri, matkap uçları, sanayi için (demonte) çalışma tezgahları, akülü el aletleri ve benzeri endüstriyel ürünler.
- WINKEL markasının yetkili bayisi olarak (sanayi, otomotiv ve denizcilik sektörlerine yönelik):
  * Anaerobik ürünler: vida/dişli sabitleyiciler (PRO 2W43, 2W70, 2W77 serisi), boru dişli sızdırmazlık ürünleri (PRO 5W11, 5W72, 5W77, 5W42, 5W65 serisi ve WIN-LOCK sızdırmazlık ipi), flanş sızdırmazlık ürünleri (PRO 5W18, 5W10 serisi), kenetleyici/tutturucu ürünler (PRO 6W01, 6W20, 6W38, 6W41, 6W48 serisi) — titreşime, yağa ve yüksek sıcaklığa (150-230°C) dayanıklıdır.
  * Yapıştırıcılar: hızlı yapışan siyanoakrilat (süper) yapıştırıcılar (metal, MDF, kauçuk tipleri dahil), 2 bileşenli epoksi sistemler ve metal/çelik onarım macunları (PRO W-A, PRO Knead Steel/Water, PRO Metal Mix, ısıya dayanıklı şeffaf epoksi gibi), aşınmaya ve aside dayanıklı özel kaplamalar (PRO WINBACK serisi).
  * Elastik sızdırmazlık ürünleri: silikon sızdırmazlıklar (universal, nötr, yüksek ısı RTV silikon), poliüretan yapıştırıcı, sıvı conta, MS polimer bazlı sızdırmazlıklar, Hylomar tipi conta macunları.
  * Yağlayıcılar: yüksek sıcaklık gresleri (400°C-700°C'ye kadar, MoS2 içerikli), gıda sektörüne uygun (H1 sertifikalı) gresler ve silikon spreyler, deniz/gemi gresi, anti-seize bakır/alüminyum/seramik montaj pastaları, çok fonksiyonlu spreyler (yağlama + pas çözme + temizleme + nem giderme bir arada), zincir ve halat bakım spreyleri, PTFE kuru yağlayıcı sprey, grafitli gres sprey.
  * Metal kaplama, koruma ve yüzey işlem ürünleri: pas dönüştürücüler, koruyucu metal kaplamalar ve montaj pastaları.
  * Parça, yüzey ve el temizleyicileri; sprey boyalar.

KURALLAR:
1. Ürünler, kullanım alanları ve genel bilgilerle ilgili sorulara elinden geldiğince net ve yardımcı şekilde cevap ver.
2. STOK DURUMU veya KESİN FİYAT sorulduğunda: canlı stok/fiyat sistemine erişimin olmadığını unutma, bu yüzden kesin rakam veya "stokta var/yok" bilgisi UYDURMA. Bu durumlarda nazikçe kesin teyit için WhatsApp'tan iletişime geçmeyi öner (cevabında "WhatsApp'tan yazabilirsiniz" gibi bir ifade kullanabilirsin ama telefon numarasını asla yazma). Bu durumda, cevabının en sonuna başka hiçbir şey eklemeden tam olarak şu işareti ekle: ${WHATSAPP_BUTTON_MARKER}
3. Alakasız, uygunsuz ya da Wintek'in işiyle ilgisi olmayan taleplerde kibarca konuyu Wintek'in ürün/hizmetlerine getir ya da gerekiyorsa yukarıdaki WhatsApp yönlendirmesini (2. kuraldaki gibi) kullan.
4. Yanıtların Instagram DM/yorum ortamına uygun olsun: kısa (1-4 cümle), gereksiz uzatmadan, doğal bir müşteri temsilcisi tonunda. Emoji kullanımı ölçülü olsun, abartma.
5. Kendini yapay zeka olarak tanıtmana gerek yok, Wintek adına yazan doğal bir temsilci gibi davran.
6. Konuşmanın başında müşteriye otomatik bir karşılama mesajı zaten gönderiliyor. Bu yüzden sen ayrıca "hoş geldiniz", "merhaba" gibi bir karşılama cümlesiyle başlama; doğrudan müşterinin sorusuna veya talebine odaklan.
7. Eğer müşteri açıkça gerçek bir yetkili/insanla görüşmek istediğini belirtirse (örneğin: "gerçek biriyle konuşmak istiyorum", "bir yetkiliye bağlar mısınız", "insanla görüşebilir miyim", "müşteri temsilcisi istiyorum" gibi), onu nazikçe yönlendiren kısa bir cevap ver (örn: "Elbette, ekibimizden biri en kısa sürede sizinle ilgilenecek.") ve cevabının en sonuna başka hiçbir şey eklemeden tam olarak şu işareti ekle: ${HUMAN_HANDOFF_MARKER}`;

function buildSystemPrompt() {
    if (productsWithImages.length === 0) {
        return BASE_SYSTEM_PROMPT;
    }

    const lines = productsWithImages
        .map((p) => `- [${p.barcode}] ${p.title}`)
        .join("\n");

    const catalogSection = `

FOTOĞRAFI MEVCUT ÜRÜNLER (sadece bu listedeki ürünler için fotoğraf paylaşabilirsin):
${lines}

8. Müşteri yukarıdaki listede bulunan bir ürünü özellikle soruyorsa ve hangi ürünü kastettiğinden eminsen, cevabının en sonuna (varsa WhatsApp/insan devri işaretlerinden sonra, ayrı bir satırda) tam olarak şu formatta ekle: [[PRODUCT_IMAGE:BARKOD]] — BARKOD yerine yukarıdaki listeden ilgili ürünün gerçek barkodunu yaz. Listede olmayan ya da hangi ürün olduğundan emin olmadığın durumlarda bu işareti KESİNLİKLE kullanma; bu durumda elinde o ürünün fotoğrafı olmadığını söyleyip normal şekilde yardımcı ol.`;

    return `${BASE_SYSTEM_PROMPT}${catalogSection}`;
}

app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("Webhook dogrulandi.");
            return res.status(200).send(challenge);
        }

        console.warn("Webhook dogrulama basarisiz. Token eslesmedi.");
    return res.status(403).send("Forbidden");
});

app.get("/privacy", (req, res) => {
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Gizlilik Politikasi - Wintek Sosyal Medya Otomasyonu</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    h1 { font-size: 1.6em; }
    h2 { font-size: 1.2em; margin-top: 1.6em; }
    footer { margin-top: 3em; font-size: 0.85em; color: #666; }
    </style>
    </head>
    <body>
    <h1>Gizlilik Politikasi</h1>
    <p><strong>Wintek Sosyal Medya Otomasyonu</strong> uygulamasi, Wintek'in Instagram isletme hesabina gelen dogrudan mesajlara (DM) ve gonderi yorumlarina otomatik yanit vermek amaciyla gelistirilmistir. Bu sayfa, uygulamanin hangi verileri nasil isledigini aciklar.</p>
    <h2>Hangi Veriler Islenir?</h2>
    <ul>
    <li>Mesaj gonderen veya yorum yapan kullanicinin Instagram kullanici kimligi (IGSID)</li>
    <li>Gonderilen mesaj veya yorumun metin icerigi</li>
    </ul>
    <h2>Veriler Ne Amacla Kullanilir?</h2>
    <p>Bu veriler, gelen mesaj/yoruma anlamli ve baglamsal bir yanit uretmek amaciyla Meta/Instagram Graph API ve Anthropic Claude API uzerinden islenir. Konusma baglamini surdurebilmek icin son mesajlar, kullaniciya ozel olarak, sifreli bir bulut veritabaninda (Upstash Redis) en fazla 7 gun sureyle saklanir ve bu surenin sonunda otomatik olarak silinir. Veriler pazarlama, profil olusturma veya ucuncu taraflarla paylasim amaciyla kullanilmaz.</p>
    <h2>Veri Saklama</h2>
    <p>Konusma gecmisi en fazla 7 gun saklanip otomatik silinir. Sunucu calisma gunluklerinde (log) teknik hata ayiklama amaciyla kisa sureligine tutulabilir ve duzenli olarak temizlenir.</p>
    <h2>Ucuncu Taraflarla Paylasim</h2>
    <p>Toplanan veriler, yanit gonderme islemini gerceklestirmek icin gereken Meta/Instagram Graph API ve yaniti olusturmak icin gereken Anthropic Claude API cagrilari disinda hicbir ucuncu tarafla paylasilmaz veya satilmaz.</p>
    <h2>Veri Silme Talepleri</h2>
    <p>Verilerinizin silinmesini talep etmek icin asagidaki iletisim adresinden bize ulasabilirsiniz.</p>
    <h2>Iletisim</h2>
    <p>Sorulariniz icin: <a href="mailto:alkanedim@gmail.com">alkanedim@gmail.com</a></p>
    <footer>Son guncelleme: 6 Eylul 2026</footer>
    </body>
    </html>`);
});

app.get("/bayilik", (req, res) => {
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Bayilik Basvuru Formu - Wintek</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    h1 { font-size: 1.4em; margin-bottom: 4px; }
    p.intro { color: #555; margin-top: 0; }
    label { display: block; margin-top: 16px; font-weight: bold; }
    input[type=text], input[type=tel], input[type=email] { width: 100%; font-size: 1em; padding: 10px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 6px; }
    textarea { width: 100%; min-height: 100px; font-size: 1em; padding: 10px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 6px; }
    button { margin-top: 22px; padding: 12px 24px; font-size: 1em; background: #d32f2f; color: #fff; border: none; border-radius: 6px; cursor: pointer; width: 100%; }
    button:hover { background: #b71c1c; }
    .req { color: #d32f2f; }
    </style>
    </head>
    <body>
    <img src="${WINTEK_LOGO_DATA_URI}" alt="Wintek" style="display:block; max-width:220px; height:auto; margin:0 auto 24px;">
    <h1>Bayilik Başvuru Formu</h1>
    <p class="intro">Wintek / WINKEL bayilik başvurunuz için aşağıdaki bilgileri doldurun, ekibimiz en kısa sürede sizinle iletişime geçsin.</p>
    <form method="POST" action="/bayilik">
    <label for="adSoyad">Ad Soyad <span class="req">*</span></label>
    <input type="text" name="adSoyad" id="adSoyad" required>
    <label for="firma">Firma / İşletme Adı <span class="req">*</span></label>
    <input type="text" name="firma" id="firma" required>
    <label for="telefon">Telefon <span class="req">*</span></label>
    <input type="tel" name="telefon" id="telefon" required>
    <label for="sehir">Şehir</label>
    <input type="text" name="sehir" id="sehir">
    <label for="eposta">E-posta</label>
    <input type="email" name="eposta" id="eposta">
    <label for="not">Not / Mesaj</label>
    <textarea name="not" id="not" placeholder="Ilgilendiginiz urunler, mevcut is alaniniz vb. (opsiyonel)"></textarea>
    <button type="submit">Başvuruyu Gönder</button>
    </form>
    </body>
    </html>`);
});

app.post("/bayilik", async (req, res) => {
    const adSoyad = (req.body.adSoyad || "").trim();
    const firma = (req.body.firma || "").trim();
    const telefon = (req.body.telefon || "").trim();
    const sehir = (req.body.sehir || "").trim();
    const eposta = (req.body.eposta || "").trim();
    const not = (req.body.not || "").trim();

    if (!adSoyad || !firma || !telefon) {
        res.status(400).send("Ad Soyad, Firma ve Telefon alanlari zorunludur. Lutfen geri donup formu eksiksiz doldurun.");
        return;
    }

    const application = { adSoyad, firma, telefon, sehir, eposta, not, timestamp: Date.now() };

    if (redis) {
        try {
            await redis.lpush(BAYILIK_APPLICATIONS_KEY, JSON.stringify(application));
            await redis.ltrim(BAYILIK_APPLICATIONS_KEY, 0, BAYILIK_APPLICATIONS_MAX - 1);
        } catch (err) {
            console.error("Bayilik basvurusu Redis'e kaydedilemedi:", err.message);
        }
    }

    notifyAdmin(
        `🏢 <b>Yeni Bayilik Başvurusu</b>\n` +
        `Ad Soyad: ${escapeHtml(adSoyad)}\n` +
        `Firma: ${escapeHtml(firma)}\n` +
        `Telefon: ${escapeHtml(telefon)}\n` +
        (sehir ? `Şehir: ${escapeHtml(sehir)}\n` : "") +
        (eposta ? `E-posta: ${escapeHtml(eposta)}\n` : "") +
        (not ? `Not: ${escapeHtml(not)}\n` : "")
    );

    syncLeadToSheet({
        kanal: "Bayilik Formu",
        musteri: `${adSoyad} - ${firma} (${telefon})`,
        mesaj: [sehir, eposta, not].filter(Boolean).join(" / "),
        durum: "Yeni",
    });
    incrementWeeklyStat("newleads");

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Basvurunuz Alindi - Wintek</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; line-height: 1.6; color: #222; text-align: center; }
    h1 { font-size: 1.4em; }
    </style>
    </head>
    <body>
    <h1>✅ Başvurunuz alındı</h1>
    <p>Teşekkürler ${escapeHtml(adSoyad)}, bayilik başvurunuz bize ulaştı. Ekibimiz en kısa sürede sizinle iletişime geçecek.</p>
    </body>
    </html>`);
});

app.get("/admin/bayilik-basvurulari", async (req, res) => {
    if (!checkAdminKey(req, res)) return;

    let applications = [];
    if (redis) {
        try {
            const raw = await redis.lrange(BAYILIK_APPLICATIONS_KEY, 0, -1);
            applications = raw
                .map((item) => {
                    try {
                        return typeof item === "string" ? JSON.parse(item) : item;
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean);
        } catch (err) {
            console.error("Bayilik basvurulari okunamadi:", err.message);
        }
    }

    const rows = applications
        .map(
            (a) => `<tr>
            <td>${new Date(a.timestamp).toLocaleString("tr-TR")}</td>
            <td>${escapeHtml(a.adSoyad)}</td>
            <td>${escapeHtml(a.firma)}</td>
            <td>${escapeHtml(a.telefon)}</td>
            <td>${escapeHtml(a.sehir || "-")}</td>
            <td>${escapeHtml(a.eposta || "-")}</td>
            <td>${escapeHtml(a.not || "-")}</td>
            </tr>`
        )
        .join("");

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Bayilik Basvurulari - Wintek</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 1000px; margin: 40px auto; padding: 0 20px; line-height: 1.5; color: #222; }
    h1 { font-size: 1.4em; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.92em; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    th { background: #f5f5f5; }
    </style>
    </head>
    <body>
    <h1>Bayilik Başvuruları (${applications.length})</h1>
    <table>
    <tr><th>Tarih</th><th>Ad Soyad</th><th>Firma</th><th>Telefon</th><th>Şehir</th><th>E-posta</th><th>Not</th></tr>
    ${rows || `<tr><td colspan="7">Henuz basvuru yok.</td></tr>`}
    </table>
    </body>
    </html>`);
});

app.post("/webhook", (req, res) => {
    res.status(200).send("EVENT_RECEIVED");

         const body = req.body;
    console.log("RAW webhook body:", JSON.stringify(body));

         if (body.object !== "instagram") return;

         const entries = body.entry || [];

         for (const entry of entries) {
             const messagingEvents = entry.messaging || [];
             for (const event of messagingEvents) {
                 handleDirectMessage(event);
             }

    const changes = entry.changes || [];
             for (const change of changes) {
                 if (change.field === "comments") {
                     handleComment(change.value);
                 } else if (change.field === "messages") {
                     handleDirectMessage(change.value);
                 }
             }
         }
});

app.post("/webhook/telegram", (req, res) => {
    res.status(200).send("OK");

    handleTelegramMessage(req.body).catch((err) => {
        console.error("Telegram webhook hatasi:", err.message);
    });
});

// WhatsApp Cloud API, webhook URL'sini Meta panelinden bagliarken bu adrese
// bir GET istegi atip dogrulama yapar (Instagram'daki /webhook GET'iyle ayni mantik).
app.get("/webhook/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
        console.log("WhatsApp webhook dogrulandi.");
        return res.status(200).send(challenge);
    }

    console.warn("WhatsApp webhook dogrulama basarisiz. Token eslesmedi.");
    return res.status(403).send("Forbidden");
});

app.post("/webhook/whatsapp", (req, res) => {
    res.status(200).send("EVENT_RECEIVED");

    handleWhatsAppMessage(req.body).catch((err) => {
        console.error("WhatsApp webhook hatasi:", err.message);
    });
});

// Render'in ucretsiz plani bir sure hareketsiz kalinca uykuya geciyor; servis
// "uyanirken" Meta/Telegram hizli yanit alamazsa ayni webhook olayini birkac
// kez tekrar gonderebiliyor. Bu da ayni musteri mesajinin birden fazla kez
// islenip birden fazla kez cevaplanmasina yol aciyordu. Asagidaki fonksiyon,
// her mesaj/postback/yorum/telegram-update icin benzersiz bir kimlikle Redis'e
// "SET NX" (sadece yoksa yaz) yapar; anahtar zaten varsa bu olay daha once
// islenmis demektir ve tekrar islenmez.
const DEDUP_TTL_SECONDS = 60 * 15; // Meta/Telegram'in tekrar deneme penceresinden fazlasiyla uzun
async function isDuplicateEvent(key) {
    if (!redis || !key) return false;
    try {
        const result = await redis.set(`processed:${key}`, "1", { nx: true, ex: DEDUP_TTL_SECONDS });
        return result !== "OK"; // "OK" degilse (null) anahtar zaten vardi -> tekrar
    } catch (err) {
        console.error("Tekrar mesaj kontrolu hatasi:", err.message);
        return false; // supheli durumda islemeye devam et, yanlislikla musteriyi atlamayalim
    }
}

async function getHistory(historyKey) {
    if (!redis) return [];
    try {
        const data = await redis.get(historyKey);
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error("Redis okuma hatasi:", err.message);
        return [];
    }
}

async function saveHistory(historyKey, history) {
    if (!redis) return;
    try {
        const trimmed = history.slice(-MAX_HISTORY_MESSAGES);
        await redis.set(historyKey, trimmed, { ex: HISTORY_TTL_SECONDS });
    } catch (err) {
        console.error("Redis yazma hatasi:", err.message);
    }
}

// needsHuman: bot musteriye anlamli bir cevap uretemedi (API hatasi/bos yanit,
// handoffReason "hata") ya da musteri acikca gercek biriyle gorusmek istedi
// (AI, sistem talimatindaki HUMAN_HANDOFF_MARKER'i cevaba ekledi, handoffReason "istek").
// Cagiran taraf (handleDirectMessage vb.) bu durumda admin'e bildirim gonderir.
async function generateAIReply(historyKey, userText, maxTokens) {
    if (!anthropic) {
        return { text: FALLBACK_REPLY, whatsapp: false, productImageUrl: null, needsHuman: true, handoffReason: "hata" };
    }

const history = await getHistory(historyKey);
    // history icindeki kayitlar (ozellikle panelden yazilan admin cevaplari) "source"
    // gibi ekstra alanlar tasiyabilir; Claude API'ye sadece role/content gonderiyoruz.
    const messages = [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: userText }];

try {
    const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system: buildSystemPrompt(),
        messages,
    });

    const rawText = (response.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

    if (!rawText) {
        return { text: FALLBACK_REPLY, whatsapp: false, productImageUrl: null, needsHuman: true, handoffReason: "hata" };
    }

    const whatsapp = rawText.includes(WHATSAPP_BUTTON_MARKER);
    let cleanText = rawText.split(WHATSAPP_BUTTON_MARKER).join("").trim();

    const needsHuman = cleanText.includes(HUMAN_HANDOFF_MARKER);
    cleanText = cleanText.split(HUMAN_HANDOFF_MARKER).join("").trim();

    let productImageUrl = null;
    const productMatch = cleanText.match(PRODUCT_IMAGE_MARKER_REGEX);
    if (productMatch) {
        const barcode = productMatch[1];
        const product = productsWithImages.find((p) => p.barcode === barcode);
        if (product && product.images.length > 0) {
            productImageUrl = product.images[0];
            trackAskedProduct(product.title);
        }
        cleanText = cleanText.replace(PRODUCT_IMAGE_MARKER_REGEX, "").trim();
    }

    const finalText = cleanText || FALLBACK_REPLY;

    const updatedHistory = [...messages, { role: "assistant", content: finalText }];
    await saveHistory(historyKey, updatedHistory);

    return { text: finalText, whatsapp, productImageUrl, needsHuman, handoffReason: needsHuman ? "istek" : null };
} catch (err) {
    console.error("Claude API hatasi:", err.response?.data || err.message);
    return { text: FALLBACK_REPLY, whatsapp: false, productImageUrl: null, needsHuman: true, handoffReason: "hata" };
}
}

async function handleDirectMessage(event) {
    const senderId = event.sender?.id;
    const message = event.message;
    const postback = event.postback;

if (!senderId || senderId === IG_BUSINESS_ACCOUNT_ID) return;

if (message?.is_echo) return;

// Kalici buton sablonundaki bir butona dokunuldugunda Instagram bunu
// event.message degil event.postback olarak gonderir. Ikisini de ayni
// akista, sanki musteri postback.title'i yazmis gibi isliyoruz.
const incomingText = message?.text || postback?.title;
if (!incomingText) return;

// Ayni webhook olayi (mid) Meta tarafindan tekrar gonderilmis olabilir
// (orn. servis uykudan uyanirken zamaninda cevap alinamadiginda). Daha
// once islenmisse burada durup musteriye tekrar cevap gitmesini onleriz.
const dedupKey = message?.mid || postback?.mid;
if (await isDuplicateEvent(dedupKey)) {
    console.log(`Tekrar eden DM/postback atlandi (mid: ${dedupKey})`);
    return;
}

// Yanit suresi raporu icin: musteri mesaji alindigi an, asagidaki cevap
// gonderim noktalarindan biri tetiklendiginde bu zamana gore olculur.
const receivedAt = Date.now();

console.log(`DM alindi - Gonderen: ${senderId}, Mesaj: "${incomingText}"`);

touchLastCustomerMessage(senderId);
incrementWeeklyStat("messages");

const historyKey = `conv:dm:${senderId}`;
const existingHistory = await getHistory(historyKey);
if (existingHistory.length === 0) {
    await sendDirectReplyWithButtons(senderId, WELCOME_MESSAGE, WELCOME_BUTTONS_PRIMARY);
    await sendDirectReplyWithButtons(senderId, WELCOME_BUTTONS_SECONDARY_TEXT, WELCOME_BUTTONS_SECONDARY);
    syncLeadToSheet({ kanal: "Instagram DM", musteri: senderId, mesaj: incomingText, durum: "Yeni" });
    incrementWeeklyStat("newleads");
    ensureLeadCreated("dm", senderId);
}

// "Bayilik" hazir cevap butonuna basilirsa AI'ya gitmeden dogrudan iki secenek
// sunuyoruz: kisa bir online basvuru formu ya da WhatsApp'tan direkt yazisma.
if (postback?.payload === "QR_DEALER") {
    await sendDirectReplyWithButtons(
        senderId,
        "Bayilik başvurunuzu hemen online formdan iletebilir ya da doğrudan WhatsApp'tan ekibimizle görüşebilirsiniz:",
        [
            { type: "web_url", url: BAYILIK_FORM_URL, title: "Başvuru Formu" },
            { type: "web_url", url: WHATSAPP_LINK, title: "WhatsApp'tan Yaz" },
        ]
    );
    recordResponseTime("dm", receivedAt);
    setLeadStatus("dm", senderId, "interested");
    notifyAdmin(
        `🏢 <b>Bayilik İlgisi - Instagram DM</b>\n` +
        `Musteri: ${escapeHtml(senderId)}\n\n` +
        `Konusmayi gor: ${PUBLIC_URL}/panel/dm/${encodeURIComponent(senderId)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
    return;
}

// "Teknik Destek" ve "İade/Garanti" butonlari da AI'ya gitmeden dogrudan
// WhatsApp'a yonlendiriyor: bot bu konularda spesifik bir politika/prosedur
// bilgisine sahip olmadigi icin yanlis bilgi uretmesindense gercek bir ekip
// uyesiyle konusturmak daha guvenli.
if (postback?.payload === "QR_SUPPORT") {
    await sendDirectReplyWithWhatsApp(
        senderId,
        "Teknik destek için ekibimizle doğrudan WhatsApp'tan görüşebilirsiniz, size hemen yardımcı olurlar:"
    );
    recordResponseTime("dm", receivedAt);
    notifyAdmin(
        `🛠️ <b>Teknik Destek Talebi - Instagram DM</b>\n` +
        `Musteri: ${escapeHtml(senderId)}\n\n` +
        `Konusmayi gor: ${PUBLIC_URL}/panel/dm/${encodeURIComponent(senderId)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
    return;
}

if (postback?.payload === "QR_RETURN") {
    await sendDirectReplyWithWhatsApp(
        senderId,
        "İade ve garanti süreçleriyle ilgili ekibimizle WhatsApp'tan görüşebilirsiniz, size en doğru bilgiyi verirler:"
    );
    recordResponseTime("dm", receivedAt);
    notifyAdmin(
        `🔄 <b>İade/Garanti Talebi - Instagram DM</b>\n` +
        `Musteri: ${escapeHtml(senderId)}\n\n` +
        `Konusmayi gor: ${PUBLIC_URL}/panel/dm/${encodeURIComponent(senderId)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
    return;
}

// Toplu kampanya mesajindaki "Ilgileniyorum / Ilgilenmiyorum" butonlarina basilirsa
// AI'ya hic gitmeden dogrudan lead durumunu guncelliyoruz ve kisa bir tesekkur
// mesaji yolluyoruz - bot bu konuda ekstra bir yorum uretmeye calismasin diye.
if (postback?.payload === CAMPAIGN_INTERESTED_PAYLOAD || postback?.payload === CAMPAIGN_NOT_INTERESTED_PAYLOAD) {
    const interested = postback.payload === CAMPAIGN_INTERESTED_PAYLOAD;
    await setLeadStatus("dm", senderId, interested ? "interested" : "not_interested");
    await sendDirectReply(
        senderId,
        interested
            ? "Teşekkürler! İlginizi not aldık, en kısa sürede size ulaşacağız. 🙌"
            : "Anlaşıldı, teşekkür ederiz! Fikrinizi değiştirirseniz buradayız. 👋"
    );
    recordResponseTime("dm", receivedAt);
    notifyAdmin(
        `${interested ? "✅" : "🚫"} <b>Kampanya Yaniti - Instagram DM</b>\n` +
        `Musteri: ${escapeHtml(senderId)}\n` +
        `Yanit: ${interested ? "Ilgileniyorum" : "Ilgilenmiyorum"}\n\n` +
        `Konusmayi gor: ${PUBLIC_URL}/panel/dm/${encodeURIComponent(senderId)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
    return;
}

const { text, whatsapp, productImageUrl, needsHuman, handoffReason } = await generateAIReply(historyKey, incomingText, 400);

if (whatsapp) {
    await sendDirectReplyWithWhatsApp(senderId, text);
    notifyAdmin(
        `🔔 <b>Stok/Fiyat Sorusu - Instagram DM</b>\n` +
        `Musteri: ${escapeHtml(senderId)}\n` +
        `Mesaj: ${escapeHtml(incomingText)}\n\n` +
        `Konusmayi gor: ${PUBLIC_URL}/panel/dm/${encodeURIComponent(senderId)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
} else {
    await sendDirectReply(senderId, text);
}
recordResponseTime("dm", receivedAt);

if (needsHuman) {
    notifyAdmin(
        `🆘 <b>İnsan Devri Gerekiyor - Instagram DM</b>\n` +
        `Musteri: ${escapeHtml(senderId)}\n` +
        `Sebep: ${handoffReason === "istek" ? "Musteri gercek biriyle gorusmek istedi" : "Bot anlamli bir cevap uretemedi (hata/bos yanit)"}\n` +
        `Mesaj: ${escapeHtml(incomingText)}\n\n` +
        `Konusmayi gor: ${PUBLIC_URL}/panel/dm/${encodeURIComponent(senderId)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
}

if (productImageUrl) {
    await sendDirectImage(senderId, productImageUrl);
}
}

async function handleComment(value) {
    const commentId = value?.id;
    const commenterId = value?.from?.id;
    const commentText = value?.text;

if (!commenterId || commenterId === IG_BUSINESS_ACCOUNT_ID) return;

if (!commentId || !commentText) return;

if (await isDuplicateEvent(commentId)) {
    console.log(`Tekrar eden yorum atlandi (id: ${commentId})`);
    return;
}

const receivedAt = Date.now();

console.log(`Yorum alindi - Yazan: ${commenterId}, Yorum: "${commentText}"`);

incrementWeeklyStat("messages");
ensureLeadCreated("comment", commenterId);

const { text, whatsapp, needsHuman, handoffReason } = await generateAIReply(`conv:comment:${commenterId}`, commentText, 150);

const finalText = whatsapp
    ? `${text} WhatsApp: ${WHATSAPP_NUMBER_DISPLAY}`
    : text;

sendCommentReply(commentId, finalText);
recordResponseTime("comment", receivedAt);

if (whatsapp) {
    // Fiyat/stok sorusu iceren yorumlarda, yorum cevabinin yanina Meta'nin
    // "private reply" API'siyle bir kerelik DM de gonderiyoruz. Bu DM, yorum
    // altina degil dogrudan musterinin gelen kutusuna dusuyor ve donusumu artiriyor.
    sendPrivateReply(
        commentId,
        `Merhaba! 👋 Yorumunuzu gördük, buradan da yardımcı olalım:\n\n${finalText}`
    );

    notifyAdmin(
        `🔔 <b>Stok/Fiyat Sorusu - Instagram Yorum</b>\n` +
        `Yazan: ${escapeHtml(commenterId)}\n` +
        `Yorum: ${escapeHtml(commentText)}\n` +
        `(Yorum cevabinin yanina ozel DM de gonderildi)\n\n` +
        `Konusmayi gor: ${PUBLIC_URL}/panel/comment/${encodeURIComponent(commenterId)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
}

if (needsHuman) {
    notifyAdmin(
        `🆘 <b>İnsan Devri Gerekiyor - Instagram Yorum</b>\n` +
        `Yazan: ${escapeHtml(commenterId)}\n` +
        `Sebep: ${handoffReason === "istek" ? "Musteri gercek biriyle gorusmek istedi" : "Bot anlamli bir cevap uretemedi (hata/bos yanit)"}\n` +
        `Yorum: ${escapeHtml(commentText)}\n\n` +
        `Konusmayi gor: ${PUBLIC_URL}/panel/comment/${encodeURIComponent(commenterId)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
}
}

async function handleTelegramMessage(update) {
    const message = update?.message;
    const chatId = message?.chat?.id;
    const text = message?.text;

if (!chatId || !text) return;

const dedupKey = update?.update_id;
if (await isDuplicateEvent(dedupKey)) {
    console.log(`Tekrar eden Telegram guncellemesi atlandi (update_id: ${dedupKey})`);
    return;
}

console.log(`Telegram mesaji alindi - Chat: ${chatId}, Mesaj: "${text}"`);

const historyKey = `conv:telegram:${chatId}`;
const existingHistory = await getHistory(historyKey);

if (text.trim() === "/start") {
    if (existingHistory.length === 0) {
        await sendTelegramReply(chatId, WELCOME_MESSAGE);
    }
    return;
}

if (existingHistory.length === 0) {
    await sendTelegramReply(chatId, WELCOME_MESSAGE);
}

const { text: replyText, whatsapp, productImageUrl, needsHuman, handoffReason } = await generateAIReply(historyKey, text, 400);

if (whatsapp) {
    await sendTelegramReplyWithWhatsApp(chatId, replyText);
    notifyAdmin(
        `🔔 <b>Stok/Fiyat Sorusu - Telegram</b>\n` +
        `Musteri: ${escapeHtml(String(chatId))}\n` +
        `Mesaj: ${escapeHtml(text)}`
    );
} else {
    await sendTelegramReply(chatId, replyText);
}

if (needsHuman) {
    notifyAdmin(
        `🆘 <b>İnsan Devri Gerekiyor - Telegram</b>\n` +
        `Musteri: ${escapeHtml(String(chatId))}\n` +
        `Sebep: ${handoffReason === "istek" ? "Musteri gercek biriyle gorusmek istedi" : "Bot anlamli bir cevap uretemedi (hata/bos yanit)"}\n` +
        `Mesaj: ${escapeHtml(text)}`
    );
}

if (productImageUrl) {
    await sendTelegramPhoto(chatId, productImageUrl);
}
}

// WhatsApp Cloud API'nin webhook govdesi Instagram/Telegram'dan farkli bir yapida
// gelir: entry[].changes[].value.messages[] icinde metin mesajlari, statuses[]
// icinde de "iletildi/okundu" gibi durum bildirimleri bulunur. Bizi sadece
// gercek musteri mesajlari ilgilendiriyor, digerlerini sessizce atliyoruz.
async function handleWhatsAppMessage(body) {
    const entries = body?.entry || [];
    for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
            const value = change.value;
            const messages = value?.messages || [];
            for (const message of messages) {
                await handleSingleWhatsAppMessage(message);
            }
        }
    }
}

async function handleSingleWhatsAppMessage(message) {
    const from = message?.from;
    const text = message?.text?.body;
    const buttonReply = message?.interactive?.button_reply;

if (!from) return;

const dedupKey = message?.id;

// Kampanya mesajindaki "Ilgileniyorum / Ilgilenmiyorum" butonlarina basilirsa
// message.text bos gelir (message.interactive.button_reply doluyor) - bu yuzden
// asagidaki "!text" erken cikisindan ONCE, AI'ya hic gitmeden burada yakaliyoruz.
if (buttonReply?.id === CAMPAIGN_INTERESTED_PAYLOAD || buttonReply?.id === CAMPAIGN_NOT_INTERESTED_PAYLOAD) {
    if (await isDuplicateEvent(dedupKey)) {
        console.log(`Tekrar eden WhatsApp buton yaniti atlandi (id: ${dedupKey})`);
        return;
    }
    const interested = buttonReply.id === CAMPAIGN_INTERESTED_PAYLOAD;
    console.log(`WhatsApp kampanya butonu - Numara: ${from}, Yanit: ${interested ? "Ilgileniyorum" : "Ilgilenmiyorum"}`);
    await setLeadStatus("whatsapp", from, interested ? "interested" : "not_interested");
    await sendWhatsAppReply(
        from,
        interested
            ? "Teşekkürler! İlginizi not aldık, en kısa sürede size ulaşacağız. 🙌"
            : "Anlaşıldı, teşekkür ederiz! Fikrinizi değiştirirseniz buradayız. 👋"
    );
    recordResponseTime("whatsapp", Date.now());
    notifyAdmin(
        `${interested ? "✅" : "🚫"} <b>Kampanya Yaniti - WhatsApp</b>\n` +
        `Numara: ${escapeHtml(from)}\n` +
        `Yanit: ${interested ? "Ilgileniyorum" : "Ilgilenmiyorum"}\n\n` +
        `Konusmayi gor: ${PUBLIC_URL}/panel/whatsapp/${encodeURIComponent(from)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
    return;
}

if (!text) return;

if (await isDuplicateEvent(dedupKey)) {
    console.log(`Tekrar eden WhatsApp mesaji atlandi (id: ${dedupKey})`);
    return;
}

console.log(`WhatsApp mesaji alindi - Numara: ${from}, Mesaj: "${text}"`);

touchLastCustomerMessage(from);
incrementWeeklyStat("messages");

// Yanit suresi raporu icin: musteri mesaji alindigi an, asagidaki cevap
// gonderim noktalarindan biri tetiklendiginde bu zamana gore olculur.
const receivedAt = Date.now();

const historyKey = `conv:whatsapp:${from}`;
const existingHistory = await getHistory(historyKey);

if (existingHistory.length === 0) {
    await sendWhatsAppReply(from, WELCOME_MESSAGE);
    syncLeadToSheet({ kanal: "WhatsApp", musteri: from, mesaj: text, durum: "Yeni" });
    incrementWeeklyStat("newleads");
    ensureLeadCreated("whatsapp", from);
}

const { text: replyText, productImageUrl, needsHuman, handoffReason } = await generateAIReply(historyKey, text, 400);

await sendWhatsAppReply(from, replyText);
recordResponseTime("whatsapp", receivedAt);

if (needsHuman) {
    notifyAdmin(
        `🆘 <b>İnsan Devri Gerekiyor - WhatsApp</b>\n` +
        `Musteri: ${escapeHtml(from)}\n` +
        `Sebep: ${handoffReason === "istek" ? "Musteri gercek biriyle gorusmek istedi" : "Bot anlamli bir cevap uretemedi (hata/bos yanit)"}\n` +
        `Mesaj: ${escapeHtml(text)}\n` +
        `Konusmayi gor ve cevap yaz: ${PUBLIC_URL}/panel/whatsapp/${encodeURIComponent(from)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
}

if (productImageUrl) {
    await sendWhatsAppImage(from, productImageUrl);
}
}

async function sendDirectReply(recipientId, text) {
    const url = `https://graph.instagram.com/v21.0/me/messages`;

try {
    await axios.post(
        url,
        {
            recipient: { id: recipientId },
            message: { text },
        },
        {
            params: { access_token: PAGE_ACCESS_TOKEN },
        }
        );
    console.log(`DM yaniti gonderildi -> ${recipientId}`);
} catch (err) {
    console.error(
        `DM yaniti gonderilemedi -> ${recipientId}:`,
        err.response?.data || err.message
        );
}
}

// Kalici, sohbette alt alta duran buton sablonu (button template) gonderir.
// Meta bu sablonda mesaj basina en fazla 3 buton izin veriyor.
async function sendDirectReplyWithButtons(recipientId, text, buttons) {
    const url = `https://graph.instagram.com/v21.0/me/messages`;

try {
    await axios.post(
        url,
        {
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: text.slice(0, 640),
                        buttons,
                    },
                },
            },
        },
        {
            params: { access_token: PAGE_ACCESS_TOKEN },
        }
        );
    console.log(`DM yaniti (hazir cevap butonlu) gonderildi -> ${recipientId}`);
} catch (err) {
    console.error(
        `DM yaniti (hazir cevap butonlu) gonderilemedi -> ${recipientId}:`,
        err.response?.data || err.message
        );
    // Butonlu gonderim basarisiz olursa en azindan duz metni gondermeyi dene.
    sendDirectReply(recipientId, text);
}
}

async function sendDirectReplyWithWhatsApp(recipientId, text) {
    const url = `https://graph.instagram.com/v21.0/me/messages`;

try {
    await axios.post(
        url,
        {
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: text.slice(0, 640),
                        buttons: [
                            {
                                type: "web_url",
                                url: WHATSAPP_LINK,
                                title: "WhatsApp'tan Yaz",
                            },
                            ],
                    },
                },
            },
        },
            {
            params: { access_token: PAGE_ACCESS_TOKEN },
        }
        );
    console.log(`DM yaniti (WhatsApp butonlu) gonderildi -> ${recipientId}`);
} catch (err) {
    console.error(
        `DM yaniti (WhatsApp butonlu) gonderilemedi -> ${recipientId}:`,
        err.response?.data || err.message
        );
    sendDirectReply(recipientId, `${text} WhatsApp: ${WHATSAPP_NUMBER_DISPLAY}`);
}
}

async function sendDirectImage(recipientId, imageUrl) {
    const url = `https://graph.instagram.com/v21.0/me/messages`;

try {
    await axios.post(
        url,
        {
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: "image",
                    payload: {
                        url: imageUrl,
                        is_reusable: true,
                    },
                },
            },
        },
        {
            params: { access_token: PAGE_ACCESS_TOKEN },
        }
        );
    console.log(`Urun fotografi gonderildi -> ${recipientId}`);
} catch (err) {
    console.error(
        `Urun fotografi gonderilemedi -> ${recipientId}:`,
        err.response?.data || err.message
        );
}
}

async function sendCommentReply(commentId, text) {
    const url = `https://graph.instagram.com/v21.0/${commentId}/replies`;

try {
    await axios.post(
        url,
        { message: text },
        {
            params: { access_token: PAGE_ACCESS_TOKEN },
        }
        );
    console.log(`Yorum yaniti gonderildi -> ${commentId}`);
} catch (err) {
    console.error(
        `Yorum yaniti gonderilemedi -> ${commentId}:`,
        err.response?.data || err.message
        );
}
}

// Yoruma verilen genel cevabin yanina, Meta'nin izin verdigi "private reply" akisiyla
// yorum sahibine dogrudan DM gonderir. Bu API sadece yorumdan sonraki 7 gun icinde ve
// yorum basina bir kez calisir (Meta'nin kendi kisitlamasi) - dedup korumamiz zaten her
// yorumu bir kez isledigi icin bu sinirla dogal olarak uyumlu.
async function sendPrivateReply(commentId, text) {
    const url = `https://graph.instagram.com/v21.0/${commentId}/private_replies`;

try {
    await axios.post(
        url,
        { message: text },
        {
            params: { access_token: PAGE_ACCESS_TOKEN },
        }
        );
    console.log(`Yorumdan DM'e ozel yanit gonderildi -> ${commentId}`);
} catch (err) {
    console.error(
        `Yorumdan DM'e ozel yanit gonderilemedi -> ${commentId}:`,
        err.response?.data || err.message
        );
}
}

async function sendTelegramReply(chatId, text) {
    if (!TELEGRAM_BOT_TOKEN) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

try {
    await axios.post(url, {
        chat_id: chatId,
        text,
    });
    console.log(`Telegram yaniti gonderildi -> ${chatId}`);
} catch (err) {
    console.error(
        `Telegram yaniti gonderilemedi -> ${chatId}:`,
        err.response?.data || err.message
        );
}
}

async function sendTelegramReplyWithWhatsApp(chatId, text) {
    if (!TELEGRAM_BOT_TOKEN) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

try {
    await axios.post(url, {
        chat_id: chatId,
        text,
        reply_markup: {
            inline_keyboard: [[{ text: "WhatsApp'tan Yaz", url: WHATSAPP_LINK }]],
        },
    });
    console.log(`Telegram yaniti (WhatsApp butonlu) gonderildi -> ${chatId}`);
} catch (err) {
    console.error(
        `Telegram yaniti (WhatsApp butonlu) gonderilemedi -> ${chatId}:`,
        err.response?.data || err.message
        );
    sendTelegramReply(chatId, `${text} WhatsApp: ${WHATSAPP_NUMBER_DISPLAY}`);
}
}

async function sendTelegramPhoto(chatId, photoUrl) {
    if (!TELEGRAM_BOT_TOKEN) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;

try {
    await axios.post(url, {
        chat_id: chatId,
        photo: photoUrl,
    });
    console.log(`Telegram urun fotografi gonderildi -> ${chatId}`);
} catch (err) {
    console.error(
        `Telegram urun fotografi gonderilemedi -> ${chatId}:`,
        err.response?.data || err.message
        );
}
}

async function sendWhatsAppReply(to, text) {
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) return;
    const url = `https://graph.facebook.com/${WHATSAPP_CLOUD_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

try {
    await axios.post(
        url,
        {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: text },
        },
        {
            headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        }
        );
    console.log(`WhatsApp yaniti gonderildi -> ${to}`);
} catch (err) {
    console.error(
        `WhatsApp yaniti gonderilemedi -> ${to}:`,
        err.response?.data || err.message
        );
}
}

async function sendWhatsAppImage(to, imageUrl) {
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) return;
    const url = `https://graph.facebook.com/${WHATSAPP_CLOUD_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

try {
    await axios.post(
        url,
        {
            messaging_product: "whatsapp",
            to,
            type: "image",
            image: { link: imageUrl },
        },
        {
            headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        }
        );
    console.log(`WhatsApp urun fotografi gonderildi -> ${to}`);
} catch (err) {
    console.error(
        `WhatsApp urun fotografi gonderilemedi -> ${to}:`,
        err.response?.data || err.message
        );
}
}

async function setupTelegramWebhook() {
    if (!TELEGRAM_BOT_TOKEN) return;

    const webhookUrl = `${PUBLIC_URL}/webhook/telegram`;

try {
    await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        params: { url: webhookUrl },
    });
    console.log(`Telegram webhook ayarlandi -> ${webhookUrl}`);
} catch (err) {
    console.error("Telegram webhook ayarlanamadi:", err.response?.data || err.message);
}
}

// Onemli bir olay (stok/fiyat sorusu -> WhatsApp yonlendirmesi gibi) oldugunda
// isletme sahibinin kendi Telegram hesabina anlik bildirim gonderir. Musteriye
// giden mesajlardan tamamen ayri, sadece admin'e (ADMIN_TELEGRAM_CHAT_ID) gider.
async function notifyAdmin(message) {
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_TELEGRAM_CHAT_ID) return;

try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: ADMIN_TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
    });
} catch (err) {
    console.error("Admin bildirimi gonderilemedi:", err.response?.data || err.message);
}
}

// Yeni bir lead (ilk kez yazan DM musterisi veya Bayilik basvurusu) olustugunda
// Nedim'in kendi kurdugu Google Apps Script webhook'una satir eklemesi icin
// gonderiyoruz. Boylece Instagram panelinin disinda, kendi Google E-Tablosunda
// da tum lead'leri takip edebiliyor. Webhook tanimli degilse sessizce atlanir.
async function syncLeadToSheet({ kanal, musteri, mesaj, durum }) {
    if (!GOOGLE_SHEETS_WEBHOOK_URL) return;
    try {
        await axios.post(GOOGLE_SHEETS_WEBHOOK_URL, {
            tarih: new Date().toISOString(),
            kanal: kanal || "",
            musteri: musteri || "",
            mesaj: mesaj || "",
            durum: durum || "Yeni",
        });
    } catch (err) {
        console.error("Google Sheets'e lead aktarilamadi:", err.response?.data || err.message);
    }
}

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAllInstagramCustomerIds(statusFilter) {
    if (!redis) return [];
    try {
        const keys = await redis.keys("conv:dm:*");
        let ids = keys.map((k) => k.replace(/^conv:dm:/, "")).filter(Boolean);
        if (statusFilter) {
            const statuses = await Promise.all(ids.map((id) => getLeadStatus("dm", id)));
            ids = ids.filter((_, i) => statuses[i] === statusFilter);
        }
        return ids;
    } catch (err) {
        console.error("Musteri listesi alinamadi:", err.message);
        return [];
    }
}

// Normal sendDirectReply/sendDirectImage fonksiyonlari hata durumunu disariya
// dondurmuyor (sessizce logluyor); toplu gonderimde her alici icin gercek
// basari/hata durumunu raporlayabilmek icin ayri, durum donduren versiyonlar.
//
// includeButtons=true ise mesajin altina "Ilgileniyorum / Ilgilenmiyorum" butonlari
// eklenir (postback tipinde - Instagram'da kalici buton sablonlarinda kullanilan,
// zaten calistigi kanitlanmis mekanizma). Butonlar en altta gorunsun diye bu durumda
// once (varsa) resim, sonra butonlu metin gonderilir; butonsuz gonderimde sira
// degismedi (once metin, sonra resim).
async function sendBroadcastToRecipient(recipientId, message, imageUrl, includeButtons) {
    const url = `https://graph.instagram.com/v21.0/me/messages`;

    if (includeButtons) {
        if (imageUrl) {
            try {
                await axios.post(
                    url,
                    {
                        recipient: { id: recipientId },
                        message: {
                            attachment: {
                                type: "image",
                                payload: { url: imageUrl, is_reusable: true },
                            },
                        },
                    },
                    { params: { access_token: PAGE_ACCESS_TOKEN } }
                );
            } catch (err) {
                const reason = err.response?.data?.error?.message || err.message;
                return { ok: false, reason: `Resim gonderilemedi: ${reason}` };
            }
        }

        try {
            await axios.post(
                url,
                {
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: "template",
                            payload: {
                                template_type: "button",
                                text: message.slice(0, 640),
                                buttons: [
                                    { type: "postback", title: "Ilgileniyorum", payload: CAMPAIGN_INTERESTED_PAYLOAD },
                                    { type: "postback", title: "Ilgilenmiyorum", payload: CAMPAIGN_NOT_INTERESTED_PAYLOAD },
                                ],
                            },
                        },
                    },
                },
                { params: { access_token: PAGE_ACCESS_TOKEN } }
            );
        } catch (err) {
            const reason = err.response?.data?.error?.message || err.message;
            return { ok: false, reason: imageUrl ? `Resim gonderildi, butonlu mesaj basarisiz: ${reason}` : reason };
        }

        return { ok: true, reason: null };
    }

    try {
        await axios.post(
            url,
            {
                recipient: { id: recipientId },
                message: { text: message },
            },
            { params: { access_token: PAGE_ACCESS_TOKEN } }
        );
    } catch (err) {
        const reason = err.response?.data?.error?.message || err.message;
        return { ok: false, reason };
    }

    if (imageUrl) {
        try {
            await axios.post(
                url,
                {
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: "image",
                            payload: { url: imageUrl, is_reusable: true },
                        },
                    },
                },
                { params: { access_token: PAGE_ACCESS_TOKEN } }
            );
        } catch (err) {
            const reason = err.response?.data?.error?.message || err.message;
            return { ok: false, reason: `Metin gonderildi, resim basarisiz: ${reason}` };
        }
    }

    return { ok: true, reason: null };
}

async function broadcastToAllCustomers(message, imageUrl, statusFilter, includeButtons) {
    const recipientIds = await getAllInstagramCustomerIds(statusFilter);
    const results = [];
    let sent = 0;
    let failed = 0;

    for (const recipientId of recipientIds) {
        const result = await sendBroadcastToRecipient(recipientId, message, imageUrl, includeButtons);
        if (result.ok) {
            sent += 1;
        } else {
            failed += 1;
        }
        results.push({ recipientId, ...result });
        // Instagram Graph API rate limitine takilmamak icin gonderimler arasi kucuk bekleme.
        await sleep(300);
    }

    return { total: recipientIds.length, sent, failed, results };
}

// WhatsApp tarafinda kayitli musteri listesi Instagram'daki conv:dm:* ile ayni
// mantikla, conv:whatsapp:* Redis anahtarlari taranarak cikartilir.
async function getAllWhatsAppCustomerIds(statusFilter) {
    if (!redis) return [];
    try {
        const keys = await redis.keys("conv:whatsapp:*");
        let ids = keys.map((k) => k.replace(/^conv:whatsapp:/, "")).filter(Boolean);
        if (statusFilter) {
            const statuses = await Promise.all(ids.map((id) => getLeadStatus("whatsapp", id)));
            ids = ids.filter((_, i) => statuses[i] === statusFilter);
        }
        return ids;
    } catch (err) {
        console.error("WhatsApp musteri listesi alinamadi:", err.message);
        return [];
    }
}

// Instagram'daki sendBroadcastToRecipient'in WhatsApp Cloud API karsiligi.
// includeButtons=true ise tek bir "interactive/button" mesaji icinde (opsiyonel
// resim header + govde metni + iki reply-button) gonderilir - WhatsApp Instagram'in
// aksine bunu tek API cagrisinda destekliyor. includeButtons=false ise onceki
// davranis korunur: once metin, sonra (varsa) resim, ayri mesajlar halinde.
async function sendWhatsAppBroadcastToRecipient(recipientId, message, imageUrl, includeButtons) {
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
        return { ok: false, reason: "WhatsApp entegrasyonu yapilandirilmamis (WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN eksik)." };
    }
    const url = `https://graph.facebook.com/${WHATSAPP_CLOUD_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const headers = { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` };

    if (includeButtons) {
        const interactive = {
            type: "button",
            body: { text: message.slice(0, 1024) },
            action: {
                buttons: [
                    { type: "reply", reply: { id: CAMPAIGN_INTERESTED_PAYLOAD, title: "Ilgileniyorum" } },
                    { type: "reply", reply: { id: CAMPAIGN_NOT_INTERESTED_PAYLOAD, title: "Ilgilenmiyorum" } },
                ],
            },
        };
        if (imageUrl) {
            interactive.header = { type: "image", image: { link: imageUrl } };
        }
        try {
            await axios.post(
                url,
                { messaging_product: "whatsapp", to: recipientId, type: "interactive", interactive },
                { headers }
            );
            return { ok: true, reason: null };
        } catch (err) {
            const reason = err.response?.data?.error?.message || err.message;
            return { ok: false, reason };
        }
    }

    try {
        await axios.post(
            url,
            { messaging_product: "whatsapp", to: recipientId, type: "text", text: { body: message } },
            { headers }
        );
    } catch (err) {
        const reason = err.response?.data?.error?.message || err.message;
        return { ok: false, reason };
    }

    if (imageUrl) {
        try {
            await axios.post(
                url,
                { messaging_product: "whatsapp", to: recipientId, type: "image", image: { link: imageUrl } },
                { headers }
            );
        } catch (err) {
            const reason = err.response?.data?.error?.message || err.message;
            return { ok: false, reason: `Metin gonderildi, resim basarisiz: ${reason}` };
        }
    }

    return { ok: true, reason: null };
}

async function broadcastToAllWhatsAppCustomers(message, imageUrl, statusFilter, includeButtons) {
    const recipientIds = await getAllWhatsAppCustomerIds(statusFilter);
    const results = [];
    let sent = 0;
    let failed = 0;

    for (const recipientId of recipientIds) {
        const result = await sendWhatsAppBroadcastToRecipient(recipientId, message, imageUrl, includeButtons);
        if (result.ok) {
            sent += 1;
        } else {
            failed += 1;
        }
        results.push({ recipientId, ...result });
        // WhatsApp Cloud API rate limitine takilmamak icin gonderimler arasi kucuk bekleme.
        await sleep(300);
    }

    return { total: recipientIds.length, sent, failed, results };
}

function checkAdminKey(req, res) {
    if (!ADMIN_ACCESS_KEY) {
        res.status(503).send("ADMIN_ACCESS_KEY sunucuda tanimli degil. Once Render'da bu ortam degiskenini olusturun.");
        return false;
    }
    if (req.query.key !== ADMIN_ACCESS_KEY && req.body?.key !== ADMIN_ACCESS_KEY) {
        res.status(403).send("Yetkisiz erisim: gecersiz veya eksik anahtar.");
        return false;
    }
    return true;
}

app.get("/broadcast", (req, res) => {
    if (!checkAdminKey(req, res)) return;

    const key = escapeHtml(req.query.key);
    const statusOptions = LEAD_STATUSES.map(
        (s) => `<option value="${s.value}">${escapeHtml(s.label)}</option>`
    ).join("");

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Toplu Mesaj Gonder - Wintek</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    h1 { font-size: 1.4em; }
    textarea { width: 100%; min-height: 140px; font-size: 1em; padding: 10px; box-sizing: border-box; }
    input[type=text] { width: 100%; font-size: 1em; padding: 10px; box-sizing: border-box; }
    select { width: 100%; font-size: 1em; padding: 10px; box-sizing: border-box; }
    label { display: block; margin-top: 16px; font-weight: bold; }
    button { margin-top: 20px; padding: 12px 24px; font-size: 1em; background: #d32f2f; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .warn { background: #fff4e5; border: 1px solid #ffb74d; padding: 12px; border-radius: 6px; margin-top: 20px; font-size: 0.92em; }
    </style>
    </head>
    <body>
    <h1>Toplu Kampanya Mesaji</h1>
    <div class="warn" id="warnInstagram">
    <strong>Onemli (Instagram):</strong> Bu mesaj, botla daha once konusmus olan ve asagida sectigin durumdaki Instagram musterilerine gonderilmeye calisilacak. Meta'nin kurallari geregi, son 24 saat icinde size yazmamis musterilere gonderim <strong>basarisiz olabilir</strong> — sistem bunu gizlemez, sonuc sayfasinda kime gidip kime gitmedigini gorursunuz. Gonderilen mesajlar geri alinamaz.
    </div>
    <div class="warn" id="warnWhatsapp" style="display:none;">
    <strong>Onemli (WhatsApp):</strong> WhatsApp numaramiz henuz dogrulanmadigi icin bu kanal su an gercekten mesaj gonderemez. Ayrica Meta kurallari geregi, isletmenin baslattigi (son 24 saatte size yazmamis) musterilere toplu mesaj icin onceden onayli bir <strong>mesaj sablonu (template)</strong> gerekir ve bu mesajlar ucretlidir; yeni numaralarda gunluk gonderim siniri da vardir. Numara dogrulanip sablon onaylandiginda bu ekrandan gonderim yapilabilecek. Gonderilen mesajlar geri alinamaz.
    </div>
    <form method="POST" action="/broadcast">
    <input type="hidden" name="key" value="${key}">
    <label for="channel">Kanal</label>
    <select name="channel" id="channel" onchange="document.getElementById('warnInstagram').style.display = this.value === 'instagram' ? 'block' : 'none'; document.getElementById('warnWhatsapp').style.display = this.value === 'whatsapp' ? 'block' : 'none';">
    <option value="instagram">Instagram</option>
    <option value="whatsapp">WhatsApp</option>
    </select>
    <label for="statusFilter">Kime Gonderilsin</label>
    <select name="statusFilter" id="statusFilter">
    <option value="">Tum musteriler (durumdan bagimsiz)</option>
    ${statusOptions}
    </select>
    <label for="message">Mesaj</label>
    <textarea name="message" id="message" required placeholder="Musterilere gonderilecek mesaji yazin..."></textarea>
    <label for="imageUrl">Resim URL (opsiyonel)</label>
    <input type="text" name="imageUrl" id="imageUrl" placeholder="https://... (bos birakilabilir)">
    <label style="display:flex; align-items:center; gap:8px; font-weight:normal; margin-top:16px;">
    <input type="checkbox" name="includeButtons" id="includeButtons" value="1" style="width:auto;">
    <span>Mesajin altina "Ilgileniyorum / Ilgilenmiyorum" butonlarini ekle (kampanya yaniti olarak listelenir)</span>
    </label>
    <button type="submit">Gonder</button>
    </form>
    <p><a href="/panel?key=${key}">Musteri konusmalarini goruntule &rarr;</a></p>
    </body>
    </html>`);
});

app.post("/broadcast", async (req, res) => {
    if (!checkAdminKey(req, res)) return;

    const message = (req.body.message || "").trim();
    const imageUrl = toMessagingSafeImageUrl((req.body.imageUrl || "").trim());
    const key = escapeHtml(req.query.key || req.body.key);
    const rawStatusFilter = (req.body.statusFilter || "").trim();
    const statusFilter = LEAD_STATUSES.some((s) => s.value === rawStatusFilter) ? rawStatusFilter : null;
    const filterLabel = statusFilter ? leadStatusMeta(statusFilter).label : "Tum musteriler";
    const channel = req.body.channel === "whatsapp" ? "whatsapp" : "instagram";
    const includeButtons = req.body.includeButtons === "1";

    if (!message) {
        res.status(400).send("Mesaj bos olamaz.");
        return;
    }

    console.log(`Toplu mesaj baslatildi. Kanal: ${channel}, Filtre: ${filterLabel}, Uzunluk: ${message.length}, Resim: ${imageUrl ? "var" : "yok"}, Butonlu: ${includeButtons ? "evet" : "hayir"}`);
    const summary =
        channel === "whatsapp"
            ? await broadcastToAllWhatsAppCustomers(message, imageUrl || null, statusFilter, includeButtons)
            : await broadcastToAllCustomers(message, imageUrl || null, statusFilter, includeButtons);
    console.log(`Toplu mesaj tamamlandi. Toplam: ${summary.total}, Basarili: ${summary.sent}, Basarisiz: ${summary.failed}`);

    const rows = summary.results
        .map(
            (r) =>
                `<tr><td>${escapeHtml(r.recipientId)}</td><td>${r.ok ? "Basarili" : "Basarisiz"}</td><td>${escapeHtml(r.reason || "")}</td></tr>`
        )
        .join("\n");

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Toplu Mesaj Sonucu - Wintek</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 0.9em; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
    a { color: #1565c0; }
    </style>
    </head>
    <body>
    <h1>Toplu Mesaj Sonucu</h1>
    <p>Kanal: <strong>${channel === "whatsapp" ? "WhatsApp" : "Instagram"}</strong> — Filtre: <strong>${escapeHtml(filterLabel)}</strong></p>
    <p>Toplam alici: <strong>${summary.total}</strong> — Basarili: <strong>${summary.sent}</strong> — Basarisiz: <strong>${summary.failed}</strong></p>
    <table>
    <thead><tr><th>Alici ID</th><th>Durum</th><th>Not</th></tr></thead>
    <tbody>
    ${rows || "<tr><td colspan=\"3\">Kayitli musteri bulunamadi.</td></tr>"}
    </tbody>
    </table>
    <p><a href="/broadcast?key=${key}">&larr; Yeni mesaj gonder</a></p>
    </body>
    </html>`);
});

// Musteri/lead durumu takibi: her konusmaya (DM veya yorum) elle atanan bir
// asama etiketi. Redis'te ayri bir key altinda saklanir (lead:<tip>:<id>),
// konusma gecmisinden bagimsizdir ve TTL'siz kalicidir.
const LEAD_STATUSES = [
    { value: "new", label: "Yeni", color: "#1565c0" },
    { value: "interested", label: "Ilgileniyor", color: "#f9a825" },
    { value: "not_interested", label: "Ilgilenmiyor", color: "#c62828" },
    { value: "converted", label: "Satisa Dondu", color: "#2e7d32" },
    { value: "cold", label: "Sogudu", color: "#757575" },
];

// Toplu kampanya mesajlarina eklenen "Ilgileniyorum / Ilgilenmiyorum" butonlarinin
// payload/id degerleri - Instagram (postback.payload) ve WhatsApp (button_reply.id)
// webhook'larinda ayni sabitlerle karsilastiriliyor.
const CAMPAIGN_INTERESTED_PAYLOAD = "CAMPAIGN_INTERESTED";
const CAMPAIGN_NOT_INTERESTED_PAYLOAD = "CAMPAIGN_NOT_INTERESTED";
const DEFAULT_LEAD_STATUS = "new";

function leadStatusMeta(value) {
    return LEAD_STATUSES.find((s) => s.value === value) || LEAD_STATUSES[0];
}

async function getLeadStatus(type, id) {
    if (!redis) return DEFAULT_LEAD_STATUS;
    try {
        const status = await redis.get(`lead:${type}:${id}`);
        return typeof status === "string" && status ? status : DEFAULT_LEAD_STATUS;
    } catch (err) {
        console.error("Lead durumu alinamadi:", err.message);
        return DEFAULT_LEAD_STATUS;
    }
}

// Bir musteriyle ilk temas anini kalici olarak kaydeder (leadcreated:<tip>:<id>).
// Satis/donusum raporunda "toplam lead sayisi" ve "ne kadar surede gecti" hesaplarinin
// baslangic noktasi budur. NX kullanildigi icin ayni musteri icin birden fazla
// cagirilsa bile (orn. her yorumda) sadece ilk seferinde yazilir, TTL'siz kalir -
// conv:*/lead: anahtarlarinin aksine 7 gunluk konusma gecmisi suresiyle sinirli degildir.
async function ensureLeadCreated(type, id) {
    if (!redis) return;
    try {
        await redis.set(`leadcreated:${type}:${id}`, Date.now(), { nx: true });
    } catch (err) {
        console.error("Lead olusturma zamani kaydedilemedi:", err.message);
    }
}

// Her durum degisikligini (from -> to, ne zaman) kalici bir listeye ekler
// (leadhistory:<tip>:<id>). Satis/donusum raporu bu listeyi okuyarak "hangi
// durumdan hangisine ortalama ne kadar surede gecildigini" hesaplar.
async function recordLeadStatusChange(type, id, fromStatus, toStatus) {
    if (!redis) return;
    try {
        await redis.rpush(`leadhistory:${type}:${id}`, { from: fromStatus, to: toStatus, at: Date.now() });
    } catch (err) {
        console.error("Lead durum gecmisi kaydedilemedi:", err.message);
    }
}

async function setLeadStatus(type, id, status) {
    if (!redis) return;
    try {
        const previousStatus = await getLeadStatus(type, id);

        if (previousStatus !== status) {
            await recordLeadStatusChange(type, id, previousStatus, status);
        }

        // Musteri "Satisa Dondu" durumuna ilk kez geciyorsa, satis sonrasi
        // memnuniyet takibi icin baslangic zamanini kaydet. Zaten "converted"
        // ise (admin ayni durumu tekrar kaydettiyse) sayaci sifirlama.
        if (type === "dm" && status === "converted" && previousStatus !== "converted") {
            await redis.set(`convertedsince:dm:${id}`, Date.now());
        }
        await redis.set(`lead:${type}:${id}`, status);
    } catch (err) {
        console.error("Lead durumu kaydedilemedi:", err.message);
    }
}

// "Ilgileniyor" durumundaki musteriler belirli bir sure (FOLLOWUP_DELAY_MS)
// boyunca tekrar yazmazsa, tek seferlik otomatik bir hatirlatma mesaji gonderilir.
// Musterinin son mesaj zamani lastmsg:dm:<id> anahtarinda tutulur (handleDirectMessage
// her gercek musteri mesajinda gunceller); gonderim yapildiginda o anki son mesaj
// zamani followup:sent:dm:<id> anahtarina yazilir, boylece musteri tekrar yazip
// yeniden sessiz kalmadikca ayni donem icin ikinci kez gonderilmez.
const FOLLOWUP_DELAY_MS = 24 * 60 * 60 * 1000; // 24 saat
const FOLLOWUP_CHECK_INTERVAL_MS = 30 * 60 * 1000; // her 30 dakikada bir kontrol edilir
const FOLLOWUP_LEAD_STATUS = "interested"; // sadece "Ilgileniyor" isaretli musteriler
const FOLLOWUP_MESSAGE =
    "Merhaba! 👋 Bir süre önce bizimle iletişime geçmiştiniz, size nasıl yardımcı olabileceğimizi merak ettik. Aklınızda kalan bir soru ya da ihtiyacınız varsa buradayız, yazmanız yeterli 🙂\n\nİyi günler dileriz!";

async function touchLastCustomerMessage(id) {
    if (!redis) return;
    try {
        await redis.set(`lastmsg:dm:${id}`, Date.now(), { ex: HISTORY_TTL_SECONDS });
    } catch (err) {
        console.error("Son musteri mesaj zamani kaydedilemedi:", err.message);
    }
}

async function getLastCustomerMessageTime(id) {
    if (!redis) return null;
    try {
        const ts = await redis.get(`lastmsg:dm:${id}`);
        const n = Number(ts);
        return Number.isFinite(n) && n > 0 ? n : null;
    } catch (err) {
        console.error("Son musteri mesaj zamani alinamadi:", err.message);
        return null;
    }
}

async function getFollowupSentFor(id) {
    if (!redis) return null;
    try {
        const ts = await redis.get(`followup:sent:dm:${id}`);
        const n = Number(ts);
        return Number.isFinite(n) && n > 0 ? n : null;
    } catch (err) {
        console.error("Takip mesaji kaydi alinamadi:", err.message);
        return null;
    }
}

async function markFollowupSent(id, lastCustomerMsgTime) {
    if (!redis) return;
    try {
        await redis.set(`followup:sent:dm:${id}`, lastCustomerMsgTime, { ex: HISTORY_TTL_SECONDS });
    } catch (err) {
        console.error("Takip mesaji kaydedilemedi:", err.message);
    }
}

async function runInterestedFollowupCheck() {
    if (!redis) return;
    try {
        const ids = await getAllInstagramCustomerIds(FOLLOWUP_LEAD_STATUS);
        const now = Date.now();

        for (const id of ids) {
            const lastMsgTime = await getLastCustomerMessageTime(id);
            // Bu ozellik devreye girmeden once yazmis musteriler icin zaman bilgisi
            // yok - yanlislikla gonderim yapmamak icin bunlar atlanir.
            if (!lastMsgTime) continue;
            if (now - lastMsgTime < FOLLOWUP_DELAY_MS) continue;

            const alreadySentFor = await getFollowupSentFor(id);
            if (alreadySentFor === lastMsgTime) continue; // bu sessizlik donemi icin zaten gonderildi

            const result = await sendBroadcastToRecipient(id, FOLLOWUP_MESSAGE, null);
            if (result.ok) {
                await markFollowupSent(id, lastMsgTime);
                console.log(`Ilgileniyor takip mesaji gonderildi -> ${id}`);
                notifyAdmin(
                    `📨 <b>Otomatik Takip Mesaji Gonderildi</b>\n` +
                    `Musteri: ${escapeHtml(id)} (Ilgileniyor, 24 saat cevapsiz)\n\n` +
                    `Konusmayi gor: ${PUBLIC_URL}/panel/dm/${encodeURIComponent(id)}?key=${ADMIN_ACCESS_KEY || ""}`
                );
            } else {
                console.error(`Ilgileniyor takip mesaji gonderilemedi -> ${id}: ${result.reason}`);
            }
            await sleep(300);
        }
    } catch (err) {
        console.error("Ilgileniyor takip kontrolu hatasi:", err.message);
    }
}

// Satis sonrasi memnuniyet takibi: bir musteri panelde "Satisa Dondu" olarak
// isaretlendikten SATISFACTION_DELAY_MS sonra, musterinin cevap verip
// vermedigine bakilmaksizin tek seferlik bir memnuniyet mesaji gonderilir.
// "Ilgileniyor" takibinden farki: burada amac "hala ilgileniyor musun" degil
// "aldigin urunden memnun kaldin mi" sorusu, bu yuzden sessizlik kosulu yok.
const SATISFACTION_DELAY_MS = 24 * 60 * 60 * 1000; // 1 gun
const SATISFACTION_LEAD_STATUS = "converted"; // sadece "Satisa Dondu" isaretli musteriler
const SATISFACTION_MESSAGE =
    "Merhaba! 👋 Sizinle çalıştığımız için teşekkür ederiz. Ürünlerimizden memnun kaldınız mı? Herhangi bir sorunuz, öneriniz ya da yaşadığınız bir sorun varsa bize buradan yazabilirsiniz, memnuniyetle yardımcı oluruz 🙂\n\nİyi günler dileriz, Wintek Ailesi";

async function getConvertedSince(id) {
    if (!redis) return null;
    try {
        const ts = await redis.get(`convertedsince:dm:${id}`);
        const n = Number(ts);
        return Number.isFinite(n) && n > 0 ? n : null;
    } catch (err) {
        console.error("Satisa donme zamani alinamadi:", err.message);
        return null;
    }
}

async function getSatisfactionSentFor(id) {
    if (!redis) return null;
    try {
        const ts = await redis.get(`satisfaction:sent:dm:${id}`);
        const n = Number(ts);
        return Number.isFinite(n) && n > 0 ? n : null;
    } catch (err) {
        console.error("Memnuniyet mesaji kaydi alinamadi:", err.message);
        return null;
    }
}

async function markSatisfactionSent(id, convertedSince) {
    if (!redis) return;
    try {
        await redis.set(`satisfaction:sent:dm:${id}`, convertedSince);
    } catch (err) {
        console.error("Memnuniyet mesaji kaydedilemedi:", err.message);
    }
}

async function runSatisfactionFollowupCheck() {
    if (!redis) return;
    try {
        const ids = await getAllInstagramCustomerIds(SATISFACTION_LEAD_STATUS);
        const now = Date.now();

        for (const id of ids) {
            const convertedSince = await getConvertedSince(id);
            // Bu ozellik devreye girmeden once "Satisa Dondu" yapilmis musteriler
            // icin zaman bilgisi yok - yanlislikla gonderim yapmamak icin atlanir.
            if (!convertedSince) continue;
            if (now - convertedSince < SATISFACTION_DELAY_MS) continue;

            const alreadySentFor = await getSatisfactionSentFor(id);
            if (alreadySentFor === convertedSince) continue; // bu donusum icin zaten gonderildi

            const result = await sendBroadcastToRecipient(id, SATISFACTION_MESSAGE, null);
            if (result.ok) {
                await markSatisfactionSent(id, convertedSince);
                console.log(`Satis sonrasi memnuniyet mesaji gonderildi -> ${id}`);
                notifyAdmin(
                    `✅ <b>Satış Sonrası Memnuniyet Mesajı Gönderildi</b>\n` +
                    `Musteri: ${escapeHtml(id)} (Satisa Dondu)\n\n` +
                    `Konusmayi gor: ${PUBLIC_URL}/panel/dm/${encodeURIComponent(id)}?key=${ADMIN_ACCESS_KEY || ""}`
                );
            } else {
                console.error(`Satis sonrasi memnuniyet mesaji gonderilemedi -> ${id}: ${result.reason}`);
            }
            await sleep(300);
        }
    } catch (err) {
        console.error("Memnuniyet takip kontrolu hatasi:", err.message);
    }
}

// Haftalik ozet raporu: her Pazartesi sabahi (Turkiye saatiyle) bir onceki hafta icin
// toplam mesaj sayisi, yeni lead sayisi ve en cok sorulan urunleri Telegram'dan admin'e
// gonderir. Boylece panele girmeden genel durum gorulebilir. Sayaclar gun/hafta boyunca
// handleDirectMessage, handleComment, POST /bayilik ve generateAIReply icindeki urun
// eslesmesi noktalarinda Redis'e biriktirilir (bkz. asagidaki increment fonksiyonlari),
// bu fonksiyon sadece haftada bir okuyup rapor halinde gonderir.
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000; // Turkiye UTC+3 (sabit, DST yok)
const WEEKLY_REPORT_CHECK_INTERVAL_MS = 30 * 60 * 1000; // her 30 dakikada bir kontrol edilir
const WEEKLY_REPORT_SEND_HOUR = 9; // Pazartesi saat 09:00'dan (Turkiye) itibaren gonderilir
const WEEKLY_STATS_TTL_SECONDS = 60 * 60 * 24 * 35; // 5 hafta - eski istatistikler kendiliginden silinir

function getIstanbulNow() {
    return new Date(Date.now() + ISTANBUL_OFFSET_MS);
}

// Verilen (Istanbul saatine kaydirilmis) tarihin icinde bulundugu haftanin Pazartesi
// gununu "YYYY-MM-DD" olarak dondurur - butun haftalik sayaclar bu anahtar altinda tutulur.
function getWeekStartKey(istanbulDate) {
    const day = istanbulDate.getUTCDay(); // 0=Pazar..6=Cumartesi
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(istanbulDate);
    monday.setUTCDate(istanbulDate.getUTCDate() - diffToMonday);
    return monday.toISOString().slice(0, 10);
}

async function incrementWeeklyStat(statName) {
    if (!redis) return;
    try {
        const weekKey = getWeekStartKey(getIstanbulNow());
        const redisKey = `stats:${statName}:${weekKey}`;
        await redis.incr(redisKey);
        await redis.expire(redisKey, WEEKLY_STATS_TTL_SECONDS);
    } catch (err) {
        console.error(`Haftalik istatistik guncellenemedi (${statName}):`, err.message);
    }
}

async function trackAskedProduct(productTitle) {
    if (!redis || !productTitle) return;
    try {
        const weekKey = getWeekStartKey(getIstanbulNow());
        const redisKey = `stats:products:${weekKey}`;
        await redis.zincrby(redisKey, 1, productTitle);
        await redis.expire(redisKey, WEEKLY_STATS_TTL_SECONDS);
    } catch (err) {
        console.error("Urun sorusu istatistigi guncellenemedi:", err.message);
    }
}

// Musteri mesaji alindiktan sonra bot cevabinin fiilen gonderilmesine kadar
// gecen sureyi olcup biriktirir ("musteri yazdiginda ne kadar surede cevap
// veriyoruz" sorusunun cevabi). Iki ayri anahtar seti tutulur:
// - stats:responsetime:sum/count:<tip> -> TTL'siz, tum zamanlarin ortalamasi
// - stats:responsetime:sum/count:<tip>:<weekKey> -> haftalik ozet raporuna eklenebilsin diye
// <tip> "dm" ya da "comment" olabilir. DM'lerde olcum, Instagram API'sine gonderim
// tamamlanana kadarki (await edilen) gercek sureyi kapsar; yorumlarda cevap
// gonderimi arka planda calistigi icin (sendCommentReply await edilmiyor) olculen
// sure AI cevabinin hazirlanmasina kadar gecen sureyi yansitir.
async function recordResponseTime(type, startedAt) {
    if (!redis) return;
    try {
        const elapsedMs = Date.now() - startedAt;
        if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return;

        const weekKey = getWeekStartKey(getIstanbulNow());
        const sumKey = `stats:responsetime:sum:${type}`;
        const countKey = `stats:responsetime:count:${type}`;
        const weekSumKey = `stats:responsetime:sum:${type}:${weekKey}`;
        const weekCountKey = `stats:responsetime:count:${type}:${weekKey}`;
        const maxKey = `stats:responsetime:max:${type}`;

        await Promise.all([
            redis.incrby(sumKey, elapsedMs),
            redis.incr(countKey),
            redis.incrby(weekSumKey, elapsedMs),
            redis.incr(weekCountKey),
            redis.expire(weekSumKey, WEEKLY_STATS_TTL_SECONDS),
            redis.expire(weekCountKey, WEEKLY_STATS_TTL_SECONDS),
        ]);

        // En yavas cevabi da ayrica tutuyoruz - Render'in ucretsiz plani uykudan
        // uyanirken olusan anormal gecikmeleri fark edebilmek icin (atomik degil,
        // ama bu istatistik amacli kullanim icin yeterince guvenilir).
        const currentMax = Number(await redis.get(maxKey)) || 0;
        if (elapsedMs > currentMax) {
            await redis.set(maxKey, elapsedMs);
        }
    } catch (err) {
        console.error(`Yanit suresi kaydedilemedi (${type}):`, err.message);
    }
}

async function getResponseTimeStats(type) {
    if (!redis) return { avgMs: null, count: 0, maxMs: null };
    try {
        const [sum, count, max] = await Promise.all([
            redis.get(`stats:responsetime:sum:${type}`),
            redis.get(`stats:responsetime:count:${type}`),
            redis.get(`stats:responsetime:max:${type}`),
        ]);
        const countNum = Number(count) || 0;
        const sumNum = Number(sum) || 0;
        return {
            avgMs: countNum > 0 ? sumNum / countNum : null,
            count: countNum,
            maxMs: Number(max) || null,
        };
    } catch (err) {
        console.error(`Yanit suresi istatistigi alinamadi (${type}):`, err.message);
        return { avgMs: null, count: 0, maxMs: null };
    }
}

function formatResponseTimeTr(ms) {
    if (!Number.isFinite(ms) || ms === null) return "henuz veri yok";
    if (ms < 1000) return "1 saniyeden kisa";
    if (ms < 60000) return `${Math.round(ms / 1000)} saniye`;
    const dakika = (ms / 60000).toFixed(1);
    return `${dakika} dakika`;
}

function formatDateTr(isoDate) {
    const [y, m, d] = isoDate.split("-");
    return `${d}.${m}.${y}`;
}

async function buildWeeklyReportMessage(weekKey) {
    const [messageCount, newLeadCount, topProductsRaw, rtSumDm, rtCountDm, rtSumComment, rtCountComment, rtSumWhatsapp, rtCountWhatsapp] = await Promise.all([
        redis.get(`stats:messages:${weekKey}`),
        redis.get(`stats:newleads:${weekKey}`),
        redis.zrange(`stats:products:${weekKey}`, 0, 4, { rev: true, withScores: true }),
        redis.get(`stats:responsetime:sum:dm:${weekKey}`),
        redis.get(`stats:responsetime:count:dm:${weekKey}`),
        redis.get(`stats:responsetime:sum:comment:${weekKey}`),
        redis.get(`stats:responsetime:count:comment:${weekKey}`),
        redis.get(`stats:responsetime:sum:whatsapp:${weekKey}`),
        redis.get(`stats:responsetime:count:whatsapp:${weekKey}`),
    ]);

    const topProducts = [];
    for (let i = 0; i < topProductsRaw.length; i += 2) {
        topProducts.push({ title: topProductsRaw[i], count: Number(topProductsRaw[i + 1]) });
    }

    const weekEndDate = new Date(`${weekKey}T00:00:00.000Z`);
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);

    const rtTotalSum = (Number(rtSumDm) || 0) + (Number(rtSumComment) || 0) + (Number(rtSumWhatsapp) || 0);
    const rtTotalCount = (Number(rtCountDm) || 0) + (Number(rtCountComment) || 0) + (Number(rtCountWhatsapp) || 0);
    const avgResponseText = rtTotalCount > 0 ? formatResponseTimeTr(rtTotalSum / rtTotalCount) : "bu hafta veri yok";

    let text =
        `📊 <b>Haftalık Özet (${formatDateTr(weekKey)} - ${formatDateTr(weekEndDate.toISOString().slice(0, 10))})</b>\n\n` +
        `💬 Bu hafta gelen mesaj: <b>${Number(messageCount) || 0}</b>\n` +
        `🆕 Yeni lead: <b>${Number(newLeadCount) || 0}</b>\n` +
        `⏱ Ortalama yanıt süresi: <b>${avgResponseText}</b>\n\n`;

    if (topProducts.length > 0) {
        text += `🔥 <b>En çok sorulan ürünler:</b>\n`;
        topProducts.forEach((p, i) => {
            text += `${i + 1}. ${escapeHtml(p.title)} (${p.count})\n`;
        });
    } else {
        text += `🔥 En çok sorulan ürünler: bu hafta belirgin bir ürün sorusu olmadı.`;
    }

    text += `\nPaneli gör: ${PUBLIC_URL}/panel?key=${ADMIN_ACCESS_KEY || ""}`;

    return text.trim();
}

async function runWeeklyReportCheck({ force = false } = {}) {
    if (!redis) return;
    try {
        const nowIstanbul = getIstanbulNow();
        if (!force) {
            const isMonday = nowIstanbul.getUTCDay() === 1;
            if (!isMonday || nowIstanbul.getUTCHours() < WEEKLY_REPORT_SEND_HOUR) return;
        }

        const currentWeekKey = getWeekStartKey(nowIstanbul);
        const lastWeekMonday = new Date(`${currentWeekKey}T00:00:00.000Z`);
        lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);
        const lastWeekKey = lastWeekMonday.toISOString().slice(0, 10);

        // Bu hafta (lastWeekKey) icin rapor zaten gonderildiyse tekrar gonderme -
        // servis Render'in ucretsiz katmaninda uykuya dalip uyanabilir, bu yuzden
        // "tam saat 09:00'da bir kez" yerine "bu hafta icin gonderilmedi mi" kontrolu yapiyoruz.
        // force=true iken (manuel test) bu kontrolleri atlayip her zaman gonderir.
        if (!force) {
            const alreadySent = await redis.get(`stats:report_sent:${lastWeekKey}`);
            if (alreadySent) return;
        }

        const message = await buildWeeklyReportMessage(lastWeekKey);
        await notifyAdmin(message);
        if (!force) {
            await redis.set(`stats:report_sent:${lastWeekKey}`, "1", { ex: WEEKLY_STATS_TTL_SECONDS });
        }
        console.log(`Haftalik ozet raporu gonderildi (hafta: ${lastWeekKey}${force ? ", manuel test" : ""})`);
    } catch (err) {
        console.error("Haftalik ozet raporu kontrolu hatasi:", err.message);
    }
}

async function getConversationSummaries(type) {
    if (!redis) return [];
    const prefix = `conv:${type}:`;
    try {
        const keys = await redis.keys(`${prefix}*`);
        const summaries = await Promise.all(
            keys.map(async (key) => {
                const id = key.slice(prefix.length);
                const [history, leadStatus] = await Promise.all([
                    getHistory(key),
                    getLeadStatus(type, id),
                ]);
                const last = history[history.length - 1];
                return {
                    id,
                    messageCount: history.length,
                    lastRole: last?.role || null,
                    lastText: typeof last?.content === "string" ? last.content : "",
                    leadStatus,
                };
            })
        );
        // Redis mesaj zaman damgasi tutmuyor, bu yuzden ID'ye gore alfabetik sirala.
        return summaries.sort((a, b) => a.id.localeCompare(b.id));
    } catch (err) {
        console.error("Konusma ozeti alinamadi:", err.message);
        return [];
    }
}

function renderPanelRows(summaries, type, key) {
    if (summaries.length === 0) {
        return `<tr><td colspan="5">Kayitli konusma yok.</td></tr>`;
    }
    return summaries
        .map((s) => {
            const preview = escapeHtml((s.lastText || "").slice(0, 80)) + (s.lastText && s.lastText.length > 80 ? "..." : "");
            const meta = leadStatusMeta(s.leadStatus);
            return `<tr>
                <td>${escapeHtml(s.id)}</td>
                <td><span class="badge" style="background:${meta.color}">${escapeHtml(meta.label)}</span></td>
                <td>${s.messageCount}</td>
                <td>${preview}</td>
                <td><a href="/panel/${type}/${encodeURIComponent(s.id)}?key=${key}">Goruntule</a></td>
            </tr>`;
        })
        .join("\n");
}

function renderConversationThread(history) {
    if (!history || history.length === 0) {
        return `<p>Bu musteri icin kayitli mesaj yok.</p>`;
    }
    return history
        .map((m) => {
            const who = m.role === "user" ? "Musteri" : (m.source === "admin" ? "Sen (Isletme)" : "Bot");
            const cls = m.role === "user" ? "msg-user" : "msg-bot";
            const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
            return `<div class="msg ${cls}"><div class="msg-role">${who}</div><div class="msg-text">${escapeHtml(text)}</div></div>`;
        })
        .join("\n");
}

// --- Basit satis/donusum raporu ---------------------------------------------
// leadcreated:<tip>:<id> anahtarlari TTL'siz oldugu icin (conv:*'in aksine 7 gun
// sonra silinmiyor) "toplam lead" sayisini bu anahtarlardan cikariyoruz - boylece
// uzun suredir sessiz kalmis ama gecmiste donusmus musteriler de rapora dahil olur.
// Bu ozellik eklenmeden once baslamis (leadcreated kaydi olmayan ama hala aktif
// conv:* gecmisi bulunan) konusmalari da kaybetmemek icin, boyle bir id bulunursa
// simdi (yaklasik olarak) leadcreated kaydini geriye donuk olusturuyoruz.
async function getAllLeadIds(type) {
    if (!redis) return [];
    try {
        const createdPrefix = `leadcreated:${type}:`;
        const convPrefix = `conv:${type}:`;
        const [createdKeys, convKeys] = await Promise.all([
            redis.keys(`${createdPrefix}*`),
            redis.keys(`${convPrefix}*`),
        ]);
        const createdIds = createdKeys.map((k) => k.slice(createdPrefix.length)).filter(Boolean);
        const convIds = convKeys.map((k) => k.slice(convPrefix.length)).filter(Boolean);

        const missingIds = convIds.filter((id) => !createdIds.includes(id));
        await Promise.all(missingIds.map((id) => ensureLeadCreated(type, id)));

        return Array.from(new Set([...createdIds, ...convIds]));
    } catch (err) {
        console.error("Lead listesi alinamadi:", err.message);
        return [];
    }
}

function formatDurationTr(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "bilinmiyor";
    if (ms < 60 * 60 * 1000) {
        const dakika = Math.max(1, Math.round(ms / 60000));
        return `${dakika} dakika`;
    }
    if (ms < 48 * 60 * 60 * 1000) {
        const saat = Math.round(ms / 3600000);
        return `${saat} saat`;
    }
    const gun = (ms / 86400000).toFixed(1);
    return `${gun} gün`;
}

// Tum lead'leri (DM + yorum) tarayip su an hangi durumda olduklarini, genel
// donusum oranini ve leadhistory kayitlarindan cikan "hangi durumdan hangisine
// ortalama ne kadar surede gecildigini" hesaplar. leadcreated anini, gecmisteki
// ilk adimin baslangic noktasi olarak sanal bir "new" girisi gibi kullanir.
async function buildConversionReport() {
    if (!redis) {
        return { totalLeads: 0, statusCounts: {}, conversionRate: 0, transitions: [], redisDisabled: true };
    }

    const [dmIds, commentIds, whatsappIds] = await Promise.all([
        getAllLeadIds("dm"),
        getAllLeadIds("comment"),
        getAllLeadIds("whatsapp"),
    ]);
    const allLeads = [
        ...dmIds.map((id) => ({ type: "dm", id })),
        ...commentIds.map((id) => ({ type: "comment", id })),
        ...whatsappIds.map((id) => ({ type: "whatsapp", id })),
    ];

    const statusCounts = { new: 0, interested: 0, converted: 0, cold: 0 };
    const transitionDurations = {}; // "from->to" -> [ms, ms, ...]

    await Promise.all(
        allLeads.map(async (lead) => {
            const [status, createdAtRaw, historyRaw] = await Promise.all([
                getLeadStatus(lead.type, lead.id),
                redis.get(`leadcreated:${lead.type}:${lead.id}`),
                redis.lrange(`leadhistory:${lead.type}:${lead.id}`, 0, -1),
            ]);
            statusCounts[status] = (statusCounts[status] || 0) + 1;

            const createdAt = Number(createdAtRaw);
            if (!Number.isFinite(createdAt)) return;

            let previousAt = createdAt;
            let previousStatus = "new";
            const history = Array.isArray(historyRaw) ? historyRaw : [];
            for (const entry of history) {
                if (!entry || typeof entry.at !== "number" || !entry.to) continue;
                const transitionKey = `${previousStatus}->${entry.to}`;
                if (!transitionDurations[transitionKey]) transitionDurations[transitionKey] = [];
                transitionDurations[transitionKey].push(entry.at - previousAt);
                previousAt = entry.at;
                previousStatus = entry.to;
            }
        })
    );

    const totalLeads = allLeads.length;
    const convertedCount = statusCounts.converted || 0;
    const conversionRate = totalLeads > 0 ? (convertedCount / totalLeads) * 100 : 0;

    const transitions = Object.entries(transitionDurations)
        .map(([transitionKey, durations]) => {
            const [from, to] = transitionKey.split("->");
            const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
            return { from, to, count: durations.length, avgMs };
        })
        .sort((a, b) => b.count - a.count);

    return { totalLeads, statusCounts, conversionRate, transitions };
}

function renderConversionReportHtml(report, key) {
    if (report.redisDisabled) {
        return `<p>Redis baglantisi olmadigi icin rapor hesaplanamiyor.</p>`;
    }

    const statusRows = LEAD_STATUSES.map((s) => {
        const count = report.statusCounts[s.value] || 0;
        const pct = report.totalLeads > 0 ? ((count / report.totalLeads) * 100).toFixed(1) : "0.0";
        return `<tr>
            <td><span class="badge" style="background:${s.color}">${escapeHtml(s.label)}</span></td>
            <td>${count}</td>
            <td>%${pct}</td>
        </tr>`;
    }).join("\n");

    const transitionRows = report.transitions.length > 0
        ? report.transitions.map((t) => {
            const fromLabel = escapeHtml(leadStatusMeta(t.from).label);
            const toLabel = escapeHtml(leadStatusMeta(t.to).label);
            return `<tr>
                <td>${fromLabel} &rarr; ${toLabel}</td>
                <td>${t.count}</td>
                <td>${escapeHtml(formatDurationTr(t.avgMs))}</td>
            </tr>`;
        }).join("\n")
        : `<tr><td colspan="3">Henuz kayitli bir durum degisikligi yok (panelden musteri durumu guncellendikce burada birikir).</td></tr>`;

    return `
    <h2>Genel Durum</h2>
    <table>
    <thead><tr><th>Durum</th><th>Lead Sayisi</th><th>Oran</th></tr></thead>
    <tbody>${statusRows}</tbody>
    </table>
    <p><b>Toplam lead:</b> ${report.totalLeads} &nbsp; | &nbsp; <b>Donusum orani (Satisa Dondu / Toplam):</b> %${report.conversionRate.toFixed(1)}</p>

    <h2>Durum Gecisleri - Ortalama Sure</h2>
    <table>
    <thead><tr><th>Gecis</th><th>Kac Lead</th><th>Ortalama Sure</th></tr></thead>
    <tbody>${transitionRows}</tbody>
    </table>
    <p style="color:#777; font-size:0.85em;">Not: "Yeni" durumu ilk temas anindan itibaren sanal baslangic noktasi olarak alinir; diger tum gecisler panelden musteri durumu elle guncellendikce kaydedilir.</p>
    `;
}

app.get("/panel", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const key = escapeHtml(req.query.key);
    const statusFilter = LEAD_STATUSES.some((s) => s.value === req.query.status) ? req.query.status : null;

    const [dmSummaries, commentSummaries, whatsappSummaries] = await Promise.all([
        getConversationSummaries("dm"),
        getConversationSummaries("comment"),
        getConversationSummaries("whatsapp"),
    ]);

    const filteredDm = statusFilter ? dmSummaries.filter((s) => s.leadStatus === statusFilter) : dmSummaries;
    const filteredComment = statusFilter ? commentSummaries.filter((s) => s.leadStatus === statusFilter) : commentSummaries;
    const filteredWhatsapp = statusFilter ? whatsappSummaries.filter((s) => s.leadStatus === statusFilter) : whatsappSummaries;

    const filterLinks = [{ label: "Tumu", value: null }, ...LEAD_STATUSES.map((s) => ({ label: s.label, value: s.value }))]
        .map((f) => {
            const active = f.value === statusFilter;
            const href = f.value ? `/panel?key=${key}&status=${f.value}` : `/panel?key=${key}`;
            return `<a href="${href}" class="filter-link${active ? " active" : ""}">${escapeHtml(f.label)}</a>`;
        })
        .join(" ");

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Musteri Konusmalari - Wintek</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    h1 { font-size: 1.4em; }
    h2 { font-size: 1.1em; margin-top: 2em; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.9em; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    a { color: #1565c0; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .nav { margin-top: 24px; font-size: 0.9em; }
    .badge { display: inline-block; padding: 3px 9px; border-radius: 12px; color: #fff; font-size: 0.8em; white-space: nowrap; }
    .filters { margin-top: 10px; }
    .filter-link { display: inline-block; margin-right: 6px; padding: 5px 12px; border-radius: 14px; background: #f1f1f1; color: #333; font-size: 0.85em; }
    .filter-link:hover { text-decoration: none; background: #e2e2e2; }
    .filter-link.active { background: #1565c0; color: #fff; }
    </style>
    </head>
    <body>
    <h1>Musteri Konusmalari (Instagram + WhatsApp)</h1>
    <div class="filters">${filterLinks}</div>

    <h2>Direkt Mesajlar (DM)</h2>
    <table>
    <thead><tr><th>Musteri ID</th><th>Durum</th><th>Mesaj Sayisi</th><th>Son Mesaj</th><th></th></tr></thead>
    <tbody>${renderPanelRows(filteredDm, "dm", key)}</tbody>
    </table>

    <h2>Gonderi Yorumlari</h2>
    <table>
    <thead><tr><th>Yorum Yapan ID</th><th>Durum</th><th>Mesaj Sayisi</th><th>Son Mesaj</th><th></th></tr></thead>
    <tbody>${renderPanelRows(filteredComment, "comment", key)}</tbody>
    </table>

    <h2>WhatsApp Sohbetleri</h2>
    <table>
    <thead><tr><th>Telefon</th><th>Durum</th><th>Mesaj Sayisi</th><th>Son Mesaj</th><th></th></tr></thead>
    <tbody>${renderPanelRows(filteredWhatsapp, "whatsapp", key)}</tbody>
    </table>

    <div class="nav"><a href="/panel/report?key=${key}">Satis/Donusum Raporu &rarr;</a> &nbsp;|&nbsp; <a href="/broadcast?key=${key}">Toplu mesaj sayfasina git &rarr;</a></div>
    </body>
    </html>`);
});

function renderResponseTimeHtml(dmStats, commentStats, whatsappStats) {
    const totalCount = dmStats.count + commentStats.count + whatsappStats.count;
    const combinedAvg = totalCount > 0
        ? (((dmStats.avgMs || 0) * dmStats.count) + ((commentStats.avgMs || 0) * commentStats.count) + ((whatsappStats.avgMs || 0) * whatsappStats.count)) / totalCount
        : null;

    const row = (label, stats) => `<tr>
        <td>${escapeHtml(label)}</td>
        <td>${stats.count > 0 ? formatResponseTimeTr(stats.avgMs) : "henuz veri yok"}</td>
        <td>${stats.count}</td>
        <td>${stats.maxMs ? formatResponseTimeTr(stats.maxMs) : "-"}</td>
    </tr>`;

    return `
    <h2>Yanit Suresi (Musteri Yazdiktan Bot Cevap Verene Kadar)</h2>
    <table>
    <thead><tr><th>Kanal</th><th>Ortalama</th><th>Olcum Sayisi</th><th>En Yavas</th></tr></thead>
    <tbody>
    ${row("Direkt Mesaj (DM)", dmStats)}
    ${row("Gonderi Yorumu", commentStats)}
    ${row("WhatsApp", whatsappStats)}
    <tr><td><b>Genel</b></td><td><b>${totalCount > 0 ? formatResponseTimeTr(combinedAvg) : "henuz veri yok"}</b></td><td><b>${totalCount}</b></td><td></td></tr>
    </tbody>
    </table>
    <p style="color:#777; font-size:0.85em;">Not: Bu olcum, ozellik eklendigi andan itibaren gelen mesajlarla birikir; gecmis mesajlar icin veri yoktur. "En yavas" deger genelde Render'in ucretsiz plani uykudan uyanirken (ilk mesajlarda 50 saniyeye kadar gecikme olabilir) olusur.</p>
    `;
}

app.get("/panel/report", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const key = escapeHtml(req.query.key);
    const [report, dmResponseStats, commentResponseStats, whatsappResponseStats] = await Promise.all([
        buildConversionReport(),
        getResponseTimeStats("dm"),
        getResponseTimeStats("comment"),
        getResponseTimeStats("whatsapp"),
    ]);

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Satis/Donusum Raporu - Wintek</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    h1 { font-size: 1.4em; }
    h2 { font-size: 1.1em; margin-top: 2em; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.9em; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    a { color: #1565c0; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .nav { margin-top: 24px; font-size: 0.9em; }
    .badge { display: inline-block; padding: 3px 9px; border-radius: 12px; color: #fff; font-size: 0.8em; white-space: nowrap; }
    </style>
    </head>
    <body>
    <h1>Satis/Donusum Raporu</h1>
    ${renderResponseTimeHtml(dmResponseStats, commentResponseStats, whatsappResponseStats)}
    ${renderConversionReportHtml(report, key)}
    <div class="nav"><a href="/panel?key=${key}">&larr; Musteri konusmalarina don</a></div>
    </body>
    </html>`);
});

app.get("/panel/:type/:id", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const { type, id } = req.params;
    if (type !== "dm" && type !== "comment" && type !== "whatsapp") {
        res.status(404).send("Gecersiz konusma turu.");
        return;
    }
    const key = escapeHtml(req.query.key);
    const historyKey = `conv:${type}:${id}`;
    const [history, currentStatus] = await Promise.all([
        getHistory(historyKey),
        getLeadStatus(type, id),
    ]);

    const statusOptions = LEAD_STATUSES.map(
        (s) => `<option value="${s.value}"${s.value === currentStatus ? " selected" : ""}>${escapeHtml(s.label)}</option>`
    ).join("");

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Konusma - ${escapeHtml(id)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    h1 { font-size: 1.2em; word-break: break-all; }
    .msg { margin: 14px 0; padding: 10px 14px; border-radius: 10px; max-width: 80%; white-space: pre-wrap; }
    .msg-user { background: #f1f1f1; margin-right: auto; }
    .msg-bot { background: #e3f2fd; margin-left: auto; text-align: right; }
    .msg-role { font-size: 0.75em; color: #777; margin-bottom: 4px; }
    a { color: #1565c0; }
    .status-form { margin: 16px 0 24px; padding: 12px 14px; background: #f7f7f7; border-radius: 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .status-form select { padding: 6px 8px; font-size: 0.9em; }
    .status-form button { padding: 6px 14px; font-size: 0.9em; background: #1565c0; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .reply-form { margin: 24px 0; padding: 14px; background: #f7f7f7; border-radius: 8px; }
    .reply-form textarea { width: 100%; box-sizing: border-box; min-height: 70px; padding: 8px; font-size: 0.95em; font-family: inherit; border: 1px solid #ccc; border-radius: 6px; resize: vertical; }
    .reply-form button { margin-top: 8px; padding: 8px 18px; font-size: 0.9em; background: #1565c0; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .reply-note { font-size: 0.85em; color: #777; margin-top: 20px; }
    </style>
    </head>
    <body>
    <h1>Konusma: ${escapeHtml(id)}</h1>
    <p><a href="/panel?key=${key}">&larr; Tum konusmalara don</a></p>
    <form method="POST" action="/panel/${type}/${encodeURIComponent(id)}/status" class="status-form">
        <input type="hidden" name="key" value="${key}">
        <label for="status">Musteri Durumu:</label>
        <select name="status" id="status">${statusOptions}</select>
        <button type="submit">Guncelle</button>
    </form>
    ${renderConversationThread(history)}
    ${(type === "whatsapp" || type === "dm") ? `
    <form method="POST" action="/panel/${type}/${encodeURIComponent(id)}/reply" class="reply-form">
        <input type="hidden" name="key" value="${key}">
        <label for="text"><strong>Musteriye cevap yaz:</strong></label><br>
        <textarea name="text" id="text" placeholder="Mesajini buraya yaz..." required></textarea>
        <br>
        <button type="submit">Gonder</button>
    </form>
    ` : `<p class="reply-note">Bu konusma turunde (yorum) panelden dogrudan cevap yazma henuz desteklenmiyor.</p>`}
    </body>
    </html>`);
});

app.post("/panel/:type/:id/reply", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const { type, id } = req.params;
    if (type !== "dm" && type !== "whatsapp") {
        res.status(404).send("Gecersiz konusma turu.");
        return;
    }
    const text = (req.body.text || "").trim();
    if (!text) {
        res.status(400).send("Bos mesaj gonderilemez.");
        return;
    }
    try {
        if (type === "whatsapp") {
            await sendWhatsAppReply(id, text);
        } else {
            await sendDirectReply(id, text);
        }
        const historyKey = `conv:${type}:${id}`;
        const history = await getHistory(historyKey);
        await saveHistory(historyKey, [...history, { role: "assistant", content: text, source: "admin" }]);
    } catch (err) {
        console.error("Panelden cevap gonderme hatasi:", err);
        res.status(500).send("Mesaj gonderilirken bir hata olustu. Sunucu loglarina bakin.");
        return;
    }
    const key = escapeHtml(req.query.key || req.body.key);
    res.redirect(`/panel/${type}/${encodeURIComponent(id)}?key=${key}`);
});

app.post("/panel/:type/:id/status", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const { type, id } = req.params;
    if (type !== "dm" && type !== "comment" && type !== "whatsapp") {
        res.status(404).send("Gecersiz konusma turu.");
        return;
    }
    const status = req.body.status;
    if (!LEAD_STATUSES.some((s) => s.value === status)) {
        res.status(400).send("Gecersiz durum degeri.");
        return;
    }
    await setLeadStatus(type, id, status);
    const key = escapeHtml(req.query.key || req.body.key);
    res.redirect(`/panel/${type}/${encodeURIComponent(id)}?key=${key}`);
});

// Test/manuel calistirma icin: normalde her 30 dakikada bir otomatik calisir,
// ama 24 saat beklemeden kontrolu simdi tetiklemek icin bu adres kullanilabilir.
app.get("/admin/run-followup-check", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    await runInterestedFollowupCheck();
    res.send("Ilgileniyor takip mesaji kontrolu calistirildi. Sonuclar icin sunucu loglarina bakin.");
});

// Test/manuel calistirma icin: normalde her 30 dakikada bir otomatik calisir,
// ama 1 gun beklemeden kontrolu simdi tetiklemek icin bu adres kullanilabilir.
app.get("/admin/run-satisfaction-check", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    await runSatisfactionFollowupCheck();
    res.send("Satis sonrasi memnuniyet kontrolu calistirildi. Sonuclar icin sunucu loglarina bakin.");
});

// Test/manuel calistirma icin: normalde Pazartesi 09:00'da (Turkiye) otomatik calisir,
// ama beklemeden kontrolu simdi tetiklemek icin bu adres kullanilabilir (force=true).
app.get("/admin/run-weekly-report", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    await runWeeklyReportCheck({ force: true });
    res.send("Haftalik ozet raporu (test) calistirildi. Sonuclar icin sunucu loglarina bakin.");
});

Promise.all([refreshProductCatalog(), setupTelegramWebhook()]).finally(() => {
    app.listen(PORT, () => {
        console.log(`Webhook sunucusu http://localhost:${PORT}/webhook adresinde calisiyor`);
    });
});

setInterval(refreshProductCatalog, PRODUCT_FEED_REFRESH_MS);
setInterval(runInterestedFollowupCheck, FOLLOWUP_CHECK_INTERVAL_MS);
setInterval(runSatisfactionFollowupCheck, FOLLOWUP_CHECK_INTERVAL_MS);
setInterval(runWeeklyReportCheck, WEEKLY_REPORT_CHECK_INTERVAL_MS);
