/* eslint-disable no-undef */
(function () {
  function rating_kp_imdb(card) {
    const network = new Lampa.Reguest();
    const cleantitle = kpCleanTitle(card.title);
    const searchDate = card.release_date || card.first_air_date || card.last_air_date || "0000";
    const searchYear = Number.parseInt(`${searchDate}`.slice(0, 4));
    const orig = card.original_title || card.original_name;
    const params = {
      id: card.id,
      url: `https://kinopoiskapiunofficial.tech/`,
      rating_url: `https://rating.kinopoisk.ru/`,
      headers: {
        "X-API-KEY": Lampa.Storage.get("rating_kp_imdb-api_key") || "2a4a0808-81a3-40ae-b0d3-e11335ede616",
      },
      cache_time: 60 * 60 * 24 * 1000, //86400000 сек = 1день Время кэша в секундах
    };
    getRating();

    function getRating() {
      const movieRating = _getCache(params.id);
      if (movieRating) {
        return _showRating(movieRating[params.id]);
      } else {
        searchFilm();
      }
    }

    function searchFilm() {
      let url = params.url;
      const url_by_title = Lampa.Utils.addUrlComponent(
        `${url}api/v2.1/films/search-by-keyword`,
        `keyword=${encodeURIComponent(cleantitle)}`,
      );
      url = card.imdb_id ? Lampa.Utils.addUrlComponent(`${url}api/v2.2/films`, `imdbId=${encodeURIComponent(card.imdb_id)}`) : url_by_title;
      network.clear();
      network.timeout(15_000);
      network.silent(
        url,
        function (json) {
          if (json.items && json.items.length > 0) chooseFilm(json.items);
          else if (json.films && json.films.length > 0) chooseFilm(json.films);
          else if (url === url_by_title) {
            chooseFilm([]);
          } else {
            network.clear();
            network.timeout(15_000);
            network.silent(
              url_by_title,
              function (json) {
                if (json.items && json.items.length > 0) chooseFilm(json.items);
                else if (json.films && json.films.length > 0) chooseFilm(json.films);
                else chooseFilm([]);
              },
              function (a, c) {
                showError(network.errorDecode(a, c));
              },
              false,
              {
                headers: params.headers,
              },
            );
          }
        },
        function (a, c) {
          showError(network.errorDecode(a, c));
        },
        false,
        {
          headers: params.headers,
        },
      );
    }

    function chooseFilm(items) {
      if (items && items.length > 0) {
        let isSure = false;
        let isImdb = false;
        for (const c of items) {
          const year = c.start_date || c.year || "0000";
          c.tmp_year = Number.parseInt(`${year}`.slice(0, 4));
        }
        if (card.imdb_id) {
          const tmp = items.filter(function (elem) {
            return (elem.imdb_id || elem.imdbId) == card.imdb_id;
          });
          if (tmp.length > 0) {
            items = tmp;
            isSure = true;
            isImdb = true;
          }
        }
        let cards = items;
        if (cards.length > 0) {
          if (orig) {
            const _tmp = cards.filter(function (elem) {
              return (
                containsTitle(elem.orig_title || elem.nameOriginal, orig) ||
                containsTitle(elem.en_title || elem.nameEn, orig) ||
                containsTitle(elem.title || elem.ru_title || elem.nameRu, orig)
              );
            });
            if (_tmp.length > 0) {
              cards = _tmp;
              isSure = true;
            }
          }
          if (card.title) {
            const _tmp2 = cards.filter(function (elem) {
              return (
                containsTitle(elem.title || elem.ru_title || elem.nameRu, card.title) ||
                containsTitle(elem.en_title || elem.nameEn, card.title) ||
                containsTitle(elem.orig_title || elem.nameOriginal, card.title)
              );
            });
            if (_tmp2.length > 0) {
              cards = _tmp2;
              isSure = true;
            }
          }
          if (cards.length > 1 && searchYear) {
            let _tmp3 = cards.filter(function (c) {
              return c.tmp_year == searchYear;
            });
            if (_tmp3.length === 0)
              _tmp3 = cards.filter(function (c) {
                return c.tmp_year && c.tmp_year > searchYear - 2 && c.tmp_year < searchYear + 2;
              });
            if (_tmp3.length > 0) cards = _tmp3;
          }
        }
        if (cards.length == 1 && isSure && !isImdb) {
          if (searchYear && cards[0].tmp_year) {
            isSure = cards[0].tmp_year > searchYear - 2 && cards[0].tmp_year < searchYear + 2;
          }
          if (isSure) {
            isSure = false;
            if (orig) {
              isSure |=
                equalTitle(cards[0].orig_title || cards[0].nameOriginal, orig) ||
                equalTitle(cards[0].en_title || cards[0].nameEn, orig) ||
                equalTitle(cards[0].title || cards[0].ru_title || cards[0].nameRu, orig);
            }
            if (card.title) {
              isSure |=
                equalTitle(cards[0].title || cards[0].ru_title || cards[0].nameRu, card.title) ||
                equalTitle(cards[0].en_title || cards[0].nameEn, card.title) ||
                equalTitle(cards[0].orig_title || cards[0].nameOriginal, card.title);
            }
          }
        }
        if (cards.length == 1 && isSure) {
          const id = cards[0].kp_id || cards[0].kinopoisk_id || cards[0].kinopoiskId || cards[0].filmId;
          const base_search = function base_search() {
            network.clear();
            network.timeout(15_000);
            network.silent(
              `${params.url}api/v2.2/films/${id}`,
              function (data) {
                const movieRating = _setCache(params.id, {
                  kp: data.ratingKinopoisk,
                  imdb: data.ratingImdb,
                  timestamp: Date.now(),
                }); // Кешируем данные
                return _showRating(movieRating);
              },
              function (a, c) {
                showError(network.errorDecode(a, c));
              },
              false,
              {
                headers: params.headers,
              },
            );
          };
          network.clear();
          network.timeout(5000);
          network.native(
            `${params.rating_url + id}.xml`,
            function (str) {
              if (str.includes("<rating>")) {
                try {
                  let ratingKinopoisk = 0;
                  let ratingImdb = 0;
                  const xml = $($.parseXML(str));
                  const kp_rating = xml.find("kp_rating");
                  if (kp_rating.length > 0) {
                    ratingKinopoisk = Number.parseFloat(kp_rating.text());
                  }
                  const imdb_rating = xml.find("imdb_rating");
                  if (imdb_rating.length > 0) {
                    ratingImdb = Number.parseFloat(imdb_rating.text());
                  }
                  const movieRating = _setCache(params.id, {
                    kp: ratingKinopoisk,
                    imdb: ratingImdb,
                    timestamp: Date.now(),
                  }); // Кешируем данные
                  return _showRating(movieRating);
                } catch {}
              }
              base_search();
            },
            function (a, c) {
              base_search();
            },
            false,
            {
              dataType: "text",
            },
          );
        } else {
          const movieRating = _setCache(params.id, {
            kp: 0,
            imdb: 0,
            timestamp: Date.now(),
          }); // Кешируем данные
          return _showRating(movieRating);
        }
      } else {
        const _movieRating = _setCache(params.id, {
          kp: 0,
          imdb: 0,
          timestamp: Date.now(),
        }); // Кешируем данные
        return _showRating(_movieRating);
      }
    }

    function cleanTitle(str) {
      return str.replace(/[\s.,:;’'`!?]+/g, " ").trim();
    }

    function kpCleanTitle(str) {
      return cleanTitle(str)
        .replace(/^[ /\\]+/, "")
        .replace(/[ /\\]+$/, "")
        .replace(/\+( *[+/\\])+/g, "+")
        .replace(/([+/\\] *)+\+/g, "+")
        .replace(/( *[/\\]+ *)+/g, "+");
    }

    function normalizeTitle(str) {
      return cleanTitle(
        str
          .toLowerCase()
          .replace(/[\-\u2010-\u2015\u2E3A\u2E3B\uFE58\uFE63\uFF0D]+/g, "-")
          .replace(/ё/g, "е"),
      );
    }

    function equalTitle(t1, t2) {
      return typeof t1 === "string" && typeof t2 === "string" && normalizeTitle(t1) === normalizeTitle(t2);
    }

    function containsTitle(str, title) {
      return typeof str === "string" && typeof title === "string" && normalizeTitle(str).includes(normalizeTitle(title));
    }

    function showError(error) {
      Lampa.Noty.show(`Рейтинг KP: ${error}`);
    }

    function _getCache(movie) {
      const timestamp = Date.now();
      const cache = Lampa.Storage.cache("kp_rating", 500, {}); //500 это лимит ключей
      if (cache[movie]) {
        if (timestamp - cache[movie].timestamp > params.cache_time) {
          // Если кеш истёк, чистим его
          delete cache[movie];
          Lampa.Storage.set("kp_rating", cache);
          return false;
        }
      } else return false;
      return cache;
    }

    function _setCache(movie, data) {
      const timestamp = Date.now();
      const cache = Lampa.Storage.cache("kp_rating", 500, {}); //500 это лимит ключей
      if (cache[movie]) {
        if (timestamp - cache[movie].timestamp > params.cache_time) {
          data.timestamp = timestamp;
          cache[movie] = data;
          Lampa.Storage.set("kp_rating", cache);
        } else data = cache[movie];
      } else {
        cache[movie] = data;
        Lampa.Storage.set("kp_rating", cache);
      }
      return data;
    }

    function _showRating(data) {
      if (data) {
        const kpRating = !Number.isNaN(data.kp) && data.kp !== null ? Number.parseFloat(data.kp).toFixed(1) : "0.0";
        const imdbRating = !Number.isNaN(data.imdb) && data.imdb !== null ? Number.parseFloat(data.imdb).toFixed(1) : "0.0";
        const render = Lampa.Activity.active().activity.render();
        $(".wait_rating", render).remove();
        $(".rate--imdb", render).removeClass("hide").find("> div").eq(0).text(imdbRating);
        $(".rate--kp", render).removeClass("hide").find("> div").eq(0).text(kpRating);
      }
    }
  }

  function startPlugin() {
    window.rating_plugin = true;

    Lampa.SettingsApi.addComponent({
      component: "rating_kp_imdb",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Lucide by Lucide Contributors - https://github.com/lucide-icons/lucide/blob/main/LICENSE --><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18.338a2.1 2.1 0 0 0-.987.244L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16l2.309-4.679A.53.53 0 0 1 12 2"/></svg>',
      name: "Рейтинг Кинопоиск/IMDB",
    });

    Lampa.SettingsApi.addParam({
      component: "rating_kp_imdb",
      param: {
        name: "rating_kp_imdb-api_key",
        type: "input",
        values: "",
        default: "2a4a0808-81a3-40ae-b0d3-e11335ede616",
      },
      field: {
        name: "Api Key kinopoiskapiunofficial.tech",
      },
    });

    Lampa.Listener.follow("full", function (e) {
      if (e.type === "complite") {
        const render = e.object.activity.render();
        if ($(".rate--kp", render).hasClass("hide") && $(".wait_rating", render).length === 0) {
          $(".info__rate", render).after(
            '<div style="width:2em;margin-top:1em;margin-right:1em" class="wait_rating"><div class="broadcast__scan"><div></div></div><div>',
          );
          rating_kp_imdb(e.data.movie);
        }
      }
    });
  }
  if (!window.rating_plugin) startPlugin();
})();
